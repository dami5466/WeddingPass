const weddingVideos = [
    "/videos/wedding1.mp4",
    "/videos/wedding2.mp4",
    "/videos/wedding3.mp4"
];

const videoA = document.getElementById("weddingVideoA");
const videoB = document.getElementById("weddingVideoB");

let currentVideo = videoA;
let nextVideo = videoB;
let currentIndex = 0;
let switching = false;

function playWeddingVideo(video, index) {
    video.src = weddingVideos[index];
    video.load();

    video.play().catch(error => {
        console.warn("Video playback could not start:", error);
    });
}

function switchWeddingVideo() {
    if (switching) return;

    switching = true;

    const nextIndex = (currentIndex + 1) % weddingVideos.length;
    const oldVideo = currentVideo;

    playWeddingVideo(nextVideo, nextIndex);

    nextVideo.classList.add("active");
    oldVideo.classList.remove("active");

    currentVideo = nextVideo;
    nextVideo = oldVideo;
    currentIndex = nextIndex;

    switching = false;
}

videoA.addEventListener("ended", switchWeddingVideo);
videoB.addEventListener("ended", switchWeddingVideo);

playWeddingVideo(currentVideo, currentIndex);

