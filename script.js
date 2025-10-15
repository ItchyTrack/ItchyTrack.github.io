async function loadPage(page) {
	const content = document.getElementById("content");
	try {
		const res = await fetch(`pages/${page}.html?cacheBust=${Date.now()}`);
		const html = await res.text();
		content.innerHTML = html;
		updateActiveLink(page);

		initSlideshows();
	} catch (err) {
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

// Global slideshow state
window.slideshows = [];
window.slideshowsNext = 0;
window.slideshowTimer = null;

async function makeSlideObject(slideshow) {
	const slidesImg = Array.from(slideshow.querySelectorAll(".slide"));
	let maxW = 0, maxH = 0;
	let imageCount = slidesImg.length;

	if (!imageCount) return;

	await Promise.all(
		slidesImg.map(img => new Promise(resolve => {
			const done = () => {
				maxW = Math.max(maxW, img.naturalWidth || 0);
				maxH = Math.max(maxH, img.naturalHeight || 0);
				resolve();
			};

			if (img.complete && img.naturalWidth > 0) {
				// Cached and ready
				done();
			} else {
				img.addEventListener("load", done, { once: true });
				img.addEventListener("error", done, { once: true });
			}
		}))
	);

	// After all images have finished loading or errored
	slideshow.style.aspectRatio = maxW && maxH ? `${maxW}/${maxH}` : "16/9";

	const slidesIndex = window.slideshows.length;
	const slides = slideshow.querySelectorAll(".slide");
	if (!slides.length) return;

	let current = 0;

	const showSlide = (index, direction = "next") => {
		slides.forEach(s =>
			s.classList.remove("active", "slide-enter-next", "slide-exit-next", "slide-enter-prev", "slide-exit-prev")
		);

		const currentSlide = slides[window.slideshows[slidesIndex].currentIndex];
		const nextSlide = slides[index];

		if (direction === "next") {
			currentSlide.classList.add("slide-exit-next");
			nextSlide.classList.add("slide-enter-next");
		} else {
			currentSlide.classList.add("slide-exit-prev");
			nextSlide.classList.add("slide-enter-prev");
		}

		nextSlide.classList.add("active");
		window.slideshows[slidesIndex].currentIndex = index;
	};

	const nextBtn = slideshow.querySelector(".next");
	const prevBtn = slideshow.querySelector(".prev");

	if (nextBtn && prevBtn) {
		nextBtn.addEventListener("click", () => {
			showSlide((window.slideshows[slidesIndex].currentIndex + 1) % slides.length, "next");
			window.slideshowsNext = (slidesIndex + 1) % window.slideshows.length;
			resetTimer();
		});
		prevBtn.addEventListener("click", () => {
			showSlide((window.slideshows[slidesIndex].currentIndex - 1 + slides.length) % slides.length, "prev");
			window.slideshowsNext = (slidesIndex + 1) % window.slideshows.length;
			resetTimer();
		});
	}

	window.slideshows.push({ slides, currentIndex: current, show: showSlide });
}

function startTimer() {
	if (window.slideshowTimer) clearInterval(window.slideshowTimer);
	window.slideshowTimer = setInterval(() => {
		let info = window.slideshows[window.slideshowsNext]
		let next = (info.currentIndex + 1) % info.slides.length;
		info.show(next, "next")
		window.slideshowsNext = (window.slideshowsNext + 1) % window.slideshows.length;
	}, 4000);
}

function resetTimer() { startTimer(); }
