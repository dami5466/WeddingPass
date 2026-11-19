(function () {
    const background = document.querySelector(".weddingpass-background");

    if (!background) return;

    const videoA = document.getElementById("weddingpassVideoA");
    const videoB = document.getElementById("weddingpassVideoB");

    if (!videoA || !videoB) return;

    const videos = [
        "/videos/wedding1.mp4",
        "/videos/wedding2.mp4",
        "/videos/wedding3.mp4"
    ];

    let currentVideo = videoA;
    let nextVideo = videoB;
    let currentIndex = 0;
    let switching = false;

    function startVideo(video, index) {
        video.src = videos[index];
        video.load();

        video.play().then(function () {
            video.classList.add("active");
        }).catch(function (error) {
            console.warn("WeddingPass background video:", error);
        });
    }

    function switchVideo() {
        if (switching) return;

        switching = true;

        const nextIndex = (currentIndex + 1) % videos.length;

        nextVideo.src = videos[nextIndex];
        nextVideo.load();

        const handleReady = function () {
            nextVideo.removeEventListener("canplay", handleReady);

            nextVideo.play().then(function () {
                nextVideo.classList.add("active");
                currentVideo.classList.remove("active");

                const oldVideo = currentVideo;
                currentVideo = nextVideo;
                nextVideo = oldVideo;

                currentIndex = nextIndex;
                switching = false;
            }).catch(function (error) {
                console.warn("Could not play next wedding video:", error);
                switching = false;
            });
        };

        nextVideo.addEventListener("canplay", handleReady);

        nextVideo.addEventListener("error", function () {
            nextVideo.removeEventListener("canplay", handleReady);
            switching = false;
            console.warn("WeddingPass could not load:", videos[nextIndex]);
        }, { once: true });
    }

    videoA.addEventListener("ended", switchVideo);
    videoB.addEventListener("ended", switchVideo);

    startVideo(videoA, currentIndex);
})();
