async function loadPage(page) {
	const content = document.getElementById("content");
	try {
		const res = await fetch(`pages/${page}.html`);
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

function initSlideshows() {
	console.log("Initializing slideshows...");

	document.querySelectorAll(".slideshow").forEach(async (slideshow) => {
		console.log("running on slides")
		const slidesImg = Array.from(slideshow.querySelectorAll('.slide'));
		let maxW = 0;
		let maxH = 0;

		await Promise.all(
			slidesImg.map(
				(img) =>
					new Promise((resolve) => {
						// If already loaded (success or fail)
						if (img.complete) {
							maxW = Math.max(maxW, img.naturalWidth || 0);
							maxH = Math.max(maxH, img.naturalHeight || 0);
							resolve();
							return;
						}

						// Otherwise, listen for load or error
						const onLoadOrError = () => {
							maxW = Math.max(maxW, img.naturalWidth || 0);
							maxH = Math.max(maxH, img.naturalHeight || 0);
							resolve();
						};

						img.addEventListener("load", onLoadOrError, { once: true });
						img.addEventListener("error", onLoadOrError, { once: true });
					})
			)
		);

		console.log("Max width:", maxW, "Max height:", maxH);

		// Apply smart aspect ratio & max width to slideshow container
		if (maxW && maxH) {
			slideshow.style.aspectRatio = `${maxW}/${maxH}`;
			slideshow.style.maxWidth = maxW + "px";
		} else {
			slideshow.style.aspectRatio = "16/9"; // fallback
		}

		// Basic slideshow switching
		const slides = slideshow.querySelectorAll('.slide');
		if (slides.length === 0) return;
		let current = 0;

		console.log("Slideshow slide count", slides.length)

		function showSlide(index, direction = "next") {
			slides.forEach((s, i) => {
				s.classList.remove(
					"active",
					"slide-enter-next",
					"slide-exit-next",
					"slide-enter-prev",
					"slide-exit-prev"
				);
			});

			const currentSlide = slides[current];
			const nextSlide = slides[index];

			// Animate current slide out
			if (direction === "next") {
				currentSlide.classList.add("slide-exit-next");
				nextSlide.classList.add("slide-enter-next");
			} else {
				currentSlide.classList.add("slide-exit-prev");
				nextSlide.classList.add("slide-enter-prev");
			}

			nextSlide.classList.add("active");
			current = index;
		}

		const nextBtn = slideshow.querySelector('.next');
		const prevBtn = slideshow.querySelector('.prev');

		if (!nextBtn || !prevBtn) {
			console.warn("Missing prev/next buttons in slideshow", slideshow);
			return;
		}

		nextBtn.addEventListener("click", () => {
			let newIndex = (current + 1) % slides.length;
			showSlide(newIndex, "next");
		});

		prevBtn.addEventListener("click", () => {
			let newIndex = (current - 1 + slides.length) % slides.length;
			showSlide(newIndex, "prev");
		});

		setInterval(() => {
			let newIndex = (current + 1) % slides.length;
			showSlide(newIndex, "next");
		}, 10000);
	});
}