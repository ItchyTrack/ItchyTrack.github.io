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
		await initSlideshows();
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

	// create slide objects serially or in parallel as you prefer
	const promises = Array.from(slideshows).map(makeSlideObject);
	await Promise.all(promises);

	// If there are any slideshows registered, ensure at least one slide is active
	window.slideshows.forEach(sinfo => {
		const slides = sinfo.slides;
		if (slides && slides.length) {
			// mark the currentIndex slide active (defensive)
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
