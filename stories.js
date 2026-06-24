document.addEventListener("DOMContentLoaded", () => {
    const videoFeed = document.getElementById("bh-video-feed-scroll");
    if (!videoFeed) return;
    videoFeed.innerHTML = '';

    // IMPORTANTE: Estos nombres deben coincidir con los archivos en /assets/videos/
    // El script optimizar.py genera estos nombres basados en tu carpeta /videos_crudos/
    const videoSources = [
        './assets/videos/bowlbhvideo.mp4', './assets/videos/kidshousevideobh.mp4',
        './assets/videos/video1bh.mp4', './assets/videos/video2bh.mp4',
        './assets/videos/video3bh.mp4', './assets/videos/video4bh.mp4',
        './assets/videos/video5bh.mp4', './assets/videos/video6bh.mp4', './assets/videos/video7bh.mp4'
    ];

    // Mezcla aleatoria completa de todos los videos para un feed dinámico en cada carga
    for (let i = videoSources.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videoSources[i], videoSources[j]] = [videoSources[j], videoSources[i]];
    }

    // Optimizamos el observador para móviles:
    // Evitamos cargar y reproducir varios al mismo tiempo
    const observerOptions = { 
        root: null, 
        rootMargin: '0px', 
        threshold: 0.6 
    };
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (video) {
                if (entry.isIntersecting) {
                    // Usamos una promesa para evitar errores si el video no ha cargado
                    const playPromise = video.play();
                    if (playPromise !== undefined) { playPromise.catch(() => { /* Auto-play prevenido */ }); }
                } else {
                    video.pause();
                }
            }
        });
    }, observerOptions);

    videoSources.forEach((src) => {
        const card = document.createElement("div");
        card.className = "video-story-card";
        const video = document.createElement("video");
        video.src = src;
        // preload 'none' evita saturar la memoria descargando 9 videos de golpe
        video.preload = "none";
        // poster: muestra el thumbnail .webp mientras el video carga (evita cuadro negro)
        video.poster = src.replace('.mp4', '.webp'); 
        video.muted = true; 
        video.defaultMuted = true; // Refuerzo para iOS
        video.loop = true; 
        video.setAttribute('playsinline', ''); // Atributo booleano crítico para iOS
        video.setAttribute('webkit-playsinline', ''); // Compatibilidad antigua

        // Manejo de errores para evitar "cuadros negros"
        video.onerror = () => {
            console.error(`❌ Error cargando video: ${src}. Verifique que el nombre coincida con el archivo optimizado.`);
            card.style.display = 'none'; // Oculta la tarjeta si el video no existe
        };

        card.appendChild(video);
        videoFeed.appendChild(card);
        videoObserver.observe(card);
    });
});