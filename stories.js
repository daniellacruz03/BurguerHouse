document.addEventListener("DOMContentLoaded", () => {
    const videoFeed = document.getElementById("bh-video-feed-scroll");
    if (!videoFeed) return;
    videoFeed.innerHTML = '';

    // IMPORTANTE: Estos nombres deben coincidir con los archivos en /assets/videos/
    const videoSources = [
        './assets/videos/bowlbhvideo.mp4', './assets/videos/kidshousevideobh.mp4',
        './assets/videos/video1bh.mp4', './assets/videos/video2bh.mp4',
        './assets/videos/video3bh.mp4', './assets/videos/video4bh.mp4',
        './assets/videos/video5bh.mp4', './assets/videos/video6bh.mp4', './assets/videos/video7bh.mp4'
    ];

    // Mezcla aleatoria de todos los videos
    for (let i = videoSources.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videoSources[i], videoSources[j]] = [videoSources[j], videoSources[i]];
    }

    // Observador ultrasensible y optimizado para ahorrar ancho de banda
    const observerOptions = { 
        root: null, 
        rootMargin: '0px', 
        threshold: 0.5 
    };

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (video) {
                const dataSrc = video.getAttribute('data-src');
                if (entry.isIntersecting) {
                    // Asignar el src de video solo cuando entra a la vista
                    if (!video.src || video.src === '' || video.getAttribute('src') === '') {
                        video.src = dataSrc;
                    }
                    const playPromise = video.play();
                    if (playPromise !== undefined) { 
                        playPromise.catch(() => { /* Auto-play prevenido por el navegador */ }); 
                    }
                } else {
                    // Pausar y liberar la transmisión HTTP cuando sale de vista
                    video.pause();
                    if (video.hasAttribute('src')) {
                        video.removeAttribute('src');
                        video.load(); // Cancela la descarga de datos en segundo plano
                    }
                }
            }
        });
    }, observerOptions);

    videoSources.forEach((src) => {
        const card = document.createElement("div");
        card.className = "video-story-card";
        const video = document.createElement("video");
        
        // Usamos data-src en lugar de src directo para evitar descargas masivas al inicio
        video.setAttribute('data-src', src);
        video.preload = "none";
        
        // poster: muestra la portada .webp liviana (25KB) antes de cargar el video
        video.poster = src.replace('.mp4', '.webp'); 
        video.muted = true; 
        video.defaultMuted = true; 
        video.loop = true; 
        video.setAttribute('playsinline', ''); 
        video.setAttribute('webkit-playsinline', ''); 

        // Manejo de errores silencioso
        video.onerror = () => {
            card.style.display = 'none'; 
        };

        card.appendChild(video);
        videoFeed.appendChild(card);
        videoObserver.observe(card);
    });
});