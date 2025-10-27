// --- Page loading (no cache-bust) ---
async function loadPage(page) {
	const content = document.getElementById("content");
	try {
		const res = await fetch(`pages/${page}.html`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();
		content.innerHTML = html;
		updateActiveLink(page);

		// clean previous slideshows + init new ones
		cleanupSlideshows();
		await initSlideshows().then(initLightbox);;
		initImageMousePan();
	} catch (err) {
		console.error("loadPage error:", err);
		content.innerHTML = "<p>Sorry, this page could not be loaded.</p>";
	}
}

function updateActiveLink(page) {
	document.querySelectorAll("nav a").forEach(link => {
		link.classList.toggle("active", link.getAttribute("href") === `#${page}`);
	});
}

window.addEventListener("hashchange", () => {
	const page = location.hash.replace("#", "") || "home";
	loadPage(page);
});

window.addEventListener("DOMContentLoaded", () => {
	const initialPage = location.hash.replace("#", "") || "home";
	loadPage(initialPage);
});

// --- Global slideshow state and helpers ---
window.slideshows = [];
window.slideshowsNext = 0;
window.slideshowTimer = null;

function cleanupSlideshows() {
	// remove timers and event listeners if needed
	if (window.slideshowTimer) {
		clearInterval(window.slideshowTimer);
		window.slideshowTimer = null;
	}
	// Reset arrays
	window.slideshows = [];
	window.slideshowsNext = 0;
}

// --- Init slideshows robustly ---
async function initSlideshows() {
	const slideshows = document.querySelectorAll(".slideshow");
	if (!slideshows.length) return startTimer(); // nothing to do, but ensure timer logic consistent

	for (const slideshow of slideshows) {
		await makeSlideObject(slideshow);
	}

	// If there are any slideshows registered, ensure at least one slide is active
	window.slideshows.forEach(sinfo => {
		const slides = sinfo.slides;
		if (slides && slides.length) {
			const idx = sinfo.currentIndex || 0;
			slides.forEach((s, i) => {
				if (i === idx) s.classList.add("active");
				else s.classList.remove("active");
			});
		}
	});

	startTimer();
}

// makeSlideObject returns a Promise that resolves when this slideshow is ready
function makeSlideObject(slideshow) {
	return new Promise((resolve) => {
		const slidesImg = Array.from(slideshow.querySelectorAll(".slide img, .slide"));
		// note: if your .slide elements are themselves <img>s change selector accordingly
		let maxW = 0, maxH = 0;

		// build an array of image elements to measure. If your slide elements ARE images, use that.
		const imgs = Array.from(slideshow.querySelectorAll("img"));
		if (!imgs.length) {
			// no images — set default ratio and continue
			slideshow.style.aspectRatio = "16/9";
			registerSlideshow(slideshow, [], resolve);
			return;
		}

		// Wait for all images to either be complete or fire load/error
		const loaders = imgs.map(img => new Promise(res => {
			const done = () => {
				// naturalWidth/naturalHeight are 0 on error or if not image; guard with 0 fallback
				maxW = Math.max(maxW, img.naturalWidth || 0);
				maxH = Math.max(maxH, img.naturalHeight || 0);
				res();
			};

			if (img.complete) {
				// handle cached images and images already loaded
				done();
			} else {
				img.addEventListener("load", done, { once: true });
				img.addEventListener("error", done, { once: true });
			}
		}));

		Promise.all(loaders).then(() => {
			if (maxW && maxH) {
				slideshow.style.aspectRatio = `${maxW}/${maxH}`;
			} else {
				slideshow.style.aspectRatio = "16/9";
			}
			registerSlideshow(slideshow, slideshow.querySelectorAll(".slide"), resolve);
		});
	});
}

function registerSlideshow(slideshow, slidesNodeList, resolve) {
	const slides = Array.from(slidesNodeList || []);
	const slidesIndex = window.slideshows.length;

	// initial index
	let current = 0;

	// ensure at least one slide has "active"
	if (slides.length) {
		slides.forEach((s, i) => s.classList.toggle("active", i === current));
	}

	const showSlide = (index, direction = "next") => {
		if (!slides.length) return;
		// defensive current index calculation
		const curIdx = window.slideshows[slidesIndex] ? window.slideshows[slidesIndex].currentIndex : 0;
		slides.forEach(s => s.classList.remove(
			"active", "slide-enter-next", "slide-exit-next",
			"slide-enter-prev", "slide-exit-prev"
		));

		const currentSlide = slides[curIdx] || slides[0];
		const nextSlide = slides[index];

		// If somehow nextSlide is undefined, guard
		if (!nextSlide) return;

		if (direction === "next") {
			currentSlide.classList.add("slide-exit-next");
			nextSlide.classList.add("slide-enter-next");
		} else {
			currentSlide.classList.add("slide-exit-prev");
			nextSlide.classList.add("slide-enter-prev");
		}

		nextSlide.classList.add("active");
		if (window.slideshows[slidesIndex]) {
			window.slideshows[slidesIndex].currentIndex = index;
		}
	};

	// push a placeholder object first so showSlide can reference it
	window.slideshows.push({ slides, currentIndex: current, show: showSlide });

	// set up controls if available
	const nextBtn = slideshow.querySelector(".next");
	const prevBtn = slideshow.querySelector(".prev");

	if (nextBtn) {
		const onNext = () => {
			const info = window.slideshows[slidesIndex];
			if (!info) return;
			showSlide((info.currentIndex + 1) % slides.length, "next");
			window.slideshowsNext = (slidesIndex + 1) % window.slideshows.length;
			resetTimer();
		};
		nextBtn.addEventListener("click", onNext);
	}

	if (prevBtn) {
		const onPrev = () => {
			const info = window.slideshows[slidesIndex];
			if (!info) return;
			showSlide((info.currentIndex - 1 + slides.length) % slides.length, "prev");
			window.slideshowsNext = (slidesIndex + 1) % window.slideshows.length;
			resetTimer();
		};
		prevBtn.addEventListener("click", onPrev);
	}

	// resolve the makeSlideObject promise to indicate this slideshow is ready
	resolve();
}

function startTimer() {
	// ensure we don't create multiple intervals
	if (window.slideshowTimer) {
		clearInterval(window.slideshowTimer);
		window.slideshowTimer = null;
	}

	// if no slideshows, nothing to start
	if (!window.slideshows.length) return;

	window.slideshowTimer = setInterval(() => {
		// defensive: find the next slideshow
		const info = window.slideshows[window.slideshowsNext];
		if (!info || !info.slides || !info.slides.length) {
			// advance pointer and continue
			window.slideshowsNext = (window.slideshowsNext + 1) % Math.max(1, window.slideshows.length);
			return;
		}
		let next = (info.currentIndex + 1) % info.slides.length;
		info.show(next, "next");
		window.slideshowsNext = (window.slideshowsNext + 1) % window.slideshows.length;
	}, 4000);
}

function resetTimer() { startTimer(); }

function initImageMousePan() {
	const containers = document.querySelectorAll(".img-mouse-pan");

	containers.forEach(container => {
		const img = container.querySelector("img");
		if (!img) return

		function getDisplaySize() {
			const rect = container.getBoundingClientRect();
			const containerW = rect.width;
			const containerH = rect.height;

			const imgRatio = img.naturalWidth / img.naturalHeight;
			const containerRatio = containerW / containerH;

			let displayW, displayH;
			if (imgRatio > containerRatio) {
				displayH = containerH;
				displayW = imgRatio * containerH;
			} else {
				displayW = containerW;
				displayH = containerW / imgRatio;
			}
			displayW = displayW * 1.1
			displayH = displayH * 1.1

			return { displayW, displayH, containerW, containerH };
		}

		function centerImage() {
			const { displayW, displayH, containerW, containerH } = getDisplaySize();
			const centerX = -(displayW - containerW) / 2;
			const centerY = -(displayH - containerH) / 2;
			img.style.width = `${displayW}px`;
			img.style.height = `${displayH}px`;
			img.style.transform = `translate(${centerX}px, ${centerY}px)`;
		}

		function handleMove(e) {
			const { displayW, displayH, containerW, containerH } = getDisplaySize();

			const overflowX = displayW - containerW;
			const overflowY = displayH - containerH;

			const rect = container.getBoundingClientRect();
			const x = (e.clientX - rect.left) / containerW;
			const y = (e.clientY - rect.top) / containerH;


			const translateX = -(overflowX / 2) + (0.5 - x) * overflowX;
			const translateY = -(overflowY / 2) + (0.5 - y) * overflowY;

			img.style.transform = `translate(${translateX}px, ${translateY}px)`;
		}

		img.addEventListener("load", centerImage);
		window.addEventListener("resize", centerImage);
		container.addEventListener("mouseenter", centerImage);
		container.addEventListener("mousemove", handleMove);

		container.addEventListener("mouseleave", () => {
			img.style.transition = "transform 0.5s ease";
			centerImage();
			setTimeout(() => {
				img.style.transition = "transform 0.1s ease-out";
			}, 500);
		});
	});
}

// --- LIGHTBOX LOGIC ---
function initLightbox() {
	const lightbox = document.getElementById("lightbox");
	const lightboxImg = lightbox.querySelector(".lightbox-image");
	const closeBtn = lightbox.querySelector(".close");
	const prevBtn = lightbox.querySelector(".prev");
	const nextBtn = lightbox.querySelector(".next");

	let currentSlides = [];
	let currentIndex = 0;

	// Attach click handlers to all slideshow slides
	document.querySelectorAll(".slideshow .slide img, .slideshow .slide").forEach(img => {
		img.style.cursor = "zoom-in";
		img.addEventListener("click", (e) => {
			// find the slideshow that this image belongs to
			const slideshow = e.target.closest(".slideshow");
			if (!slideshow) return;

			// collect slides in this slideshow
			currentSlides = Array.from(slideshow.querySelectorAll(".slide img, .slide"));
			currentIndex = currentSlides.indexOf(e.target);
			if (currentIndex < 0) currentIndex = 0;

			openLightbox();
		});
	});

	function openLightbox() {
		if (!currentSlides.length) return;
		lightboxImg.src = currentSlides[currentIndex].src;
		lightbox.classList.remove("hidden");
	}

	function closeLightbox() {
		lightbox.classList.add("hidden");
	}

	function showNext() {
		if (!currentSlides.length) return;
		currentIndex = (currentIndex + 1) % currentSlides.length;
		openLightbox();
	}

	function showPrev() {
		if (!currentSlides.length) return;
		currentIndex = (currentIndex - 1 + currentSlides.length) % currentSlides.length;
		openLightbox();
	}
	closeBtn.addEventListener("click", closeLightbox);
	nextBtn.addEventListener("click", showNext);
	prevBtn.addEventListener("click", showPrev);

	// close on click outside image or Escape key
	lightbox.addEventListener("click", (e) => {
		if (
			e.target !== lightboxImg &&
			!e.target.classList.contains("prev") &&
			!e.target.classList.contains("next") &&
			!e.target.classList.contains("close")
		) {
			closeLightbox();
		}
	});
	document.addEventListener("keydown", (e) => {
		if (lightbox.classList.contains("hidden")) return;
		if (e.key === "Escape") closeLightbox();
		if (e.key === "ArrowRight") showNext();
		if (e.key === "ArrowLeft") showPrev();
	});
}
