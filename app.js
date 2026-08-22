/**
 * Burger House — Lógica principal optimizada
 * Arquitectura Data-Driven para extras, corrección en Firebase y automatización de procesos.
 * V2: Flujo anti-crash, comanda estricta y GPS optimizado.
 */
(function () {
    'use strict';

    const CONFIG = {
        TIMEZONE: 'America/Caracas',
        WHATSAPP: '584127510090',
        PRELOADER_FALLBACK_MS: 3000,
        WEEKDAY_OPEN: 720,
        WEEKDAY_CLOSE: 1350,
        WEEKEND_OPEN: 720,
        PROMO_BASE_PRICE: 6.5,
        PROMO_COMBO_PRICE: 9.0,
        PROMO_COMBO_EXTRA: 2.5
    };

    // Referencia mutable a updateTotal (se asigna dentro del DOMContentLoaded)
    let _updateTotal = null;

    // --- META PIXEL INTEGRATION HELPER ---
    const trackMetaEvent = (eventName, params = {}) => {
        if (typeof window.fbq === 'function') {
            try {
                window.fbq('track', eventName, params);
                console.log(`[Meta Pixel] Evento '${eventName}' enviado:`, params);
            } catch (err) {
                console.warn(`[Meta Pixel] Error al enviar evento '${eventName}':`, err);
            }
        }
    };

    // Banner de consentimiento de privacidad / cookies para Meta Pixel
    const initCookieConsent = () => {
        if (localStorage.getItem('bh_cookie_consent')) return;
        const banner = document.createElement('div');
        banner.id = 'bh-cookie-banner';
        banner.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            width: 90%; max-width: 480px; background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 16px; padding: 16px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 999999; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 0.85rem;
            display: flex; flex-direction: column; gap: 12px;
        `;
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.3rem;">🍪</span>
                <p style="margin:0; line-height:1.4; color:#e0e0e0;">
                    Usamos cookies y Meta Pixel para medir la experiencia y optimizar tu pedido. Consulta nuestra <a href="privacidad.html" style="color:#ffb703; text-decoration:underline;">Política de Privacidad</a>.
                </p>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="bh-cookie-reject" style="background:transparent; border:1px solid #555; color:#ccc; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem;">Rechazar</button>
                <button id="bh-cookie-accept" style="background:#e50914; border:none; color:#fff; font-weight:600; padding:6px 16px; border-radius:8px; cursor:pointer; font-size:0.8rem;">Aceptar</button>
            </div>
        `;
        document.body.appendChild(banner);
        document.getElementById('bh-cookie-accept')?.addEventListener('click', () => {
            localStorage.setItem('bh_cookie_consent', 'accepted');
            banner.remove();
        });
        document.getElementById('bh-cookie-reject')?.addEventListener('click', () => {
            localStorage.setItem('bh_cookie_consent', 'rejected');
            banner.remove();
        });
    };

    // --- ESTADO DEL COMBO HOUSE ---
    let comboHouseState = {
        activeBurgerIndex: 0, // 0-3 (Burger 1-4)
        burgers: [
            { id: 1, ingredientes: {}, extras: {} },
            { id: 2, ingredientes: {}, extras: {} },
            { id: 3, ingredientes: {}, extras: {} },
            { id: 4, ingredientes: {}, extras: {} }
        ]
    };

    // --- FUNCIONES DEL COMBO HOUSE / COMBOS MULTI-BURGER ---
    function updateComboTabsUI() {
        const tabsNav = document.querySelector('.combo-tabs-nav');
        const comboProgress = document.querySelector('.combo-progress');
        const total = comboHouseState.burgers.length;

        if (comboProgress) {
            comboProgress.innerHTML = `Configurando Hamburguesa <span id="combo-current-burger">${comboHouseState.activeBurgerIndex + 1}</span> de ${total}`;
        }

        if (tabsNav) {
            tabsNav.innerHTML = comboHouseState.burgers.map((b, index) => `
                <button type="button" class="combo-tab ${index === comboHouseState.activeBurgerIndex ? 'active' : ''}" data-burger="${b.id}">
                    Burger ${b.id}
                </button>
            `).join('');

            tabsNav.querySelectorAll('.combo-tab').forEach((tab, index) => {
                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    switchComboBurger(index);
                });
            });
        }
    }

    function switchComboBurger(index) {
        // Guardar estado actual de la hamburguesa activa
        const currentBurger = comboHouseState.burgers[comboHouseState.activeBurgerIndex];
        const modalElement = document.getElementById('modal-hamburguesa');
        if (!modalElement) return;

        modalElement.querySelectorAll('.extra-card').forEach((card) => {
            const extraName = card.dataset.extraName;
            const isToggle = card.dataset.isToggle === 'true';
            const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
            const val = isToggle ? (valText === 'SÍ' ? 'SÍ' : 'NO') : parseInt(valText, 10) || 0;

            if (isToggle) {
                currentBurger.ingredientes[extraName] = val;
            } else {
                currentBurger.extras[extraName] = val;
            }
        });

        // Cambiar a la nueva hamburguesa
        comboHouseState.activeBurgerIndex = index;
        updateComboTabsUI();

        // Cargar estado de la nueva hamburguesa
        const newBurger = comboHouseState.burgers[index];
        modalElement.querySelectorAll('.extra-card').forEach((card) => {
            const extraName = card.dataset.extraName;
            const isToggle = card.dataset.isToggle === 'true';
            const valSpan = card.querySelector('.extra-qty-val');

            if (isToggle) {
                const savedVal = newBurger.ingredientes[extraName] || 'SÍ';
                valSpan.innerText = savedVal;
                card.classList.toggle('selected', savedVal === 'SÍ');
            } else {
                const savedVal = newBurger.extras[extraName] || 0;
                valSpan.innerText = savedVal;
            }
        });

        // Recalcular precio
        if (typeof _updateTotal === 'function') _updateTotal();
    }

    // --- BASE DE DATOS DINÁMICA DE EXTRAS ---
    const EXTRAS_DB = [
        // EXTRAS CON COSTO (Hamburguesas)
        { name: 'Extra Pollo', price: 2.50, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Carne', price: 2.50, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Pollo Crispy', price: 3.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Chuleta', price: 3.50, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Huevo (proteína)', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Cheese', price: 1.20, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Tocineta', price: 2.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Salsa de la Casa', price: 1.20, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Lechuga', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Cebolla', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Pepinillos', price: 1.20, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },
        { name: 'Extra Salsa BBQ', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esCombo },

        // EXTRAS CON COSTO (Menú Kids)
        { name: 'Extra Huevito Sorpresa', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esKids },

        // SERVICIOS EXTRAS (Nuggets / Papas) - Salsas sin costo, toggles SÍ/NO
        { name: 'Servicio de salsa BBQ', type: 'toggle', applies: c => c.isNuggets, default: () => 'NO' }, // Por defecto NO
        { name: 'Servicio de Ketchup', type: 'toggle', applies: c => c.isNuggets, default: () => 'NO' }, // Por defecto NO
        { name: 'Servicio de Salsa de la Casa', type: 'toggle', applies: c => c.isNuggets, default: () => 'SÍ' }, // Por defecto SÍ

        // COMBO PROMO (Lata + Papitas) - Solo para tarjetas de promo
        { name: 'Papitas + Lata', price: CONFIG.PROMO_COMBO_EXTRA, type: 'cost', applies: c => c.nameLower.includes('promo') && !c.esCombo },

        // INGREDIENTES BASE (Interruptores SÍ/NO) -> APLICAN ESTRICTAMENTE LEYENDO LA DESCRIPCIÓN O COMBOS
        { name: 'Pan', type: 'toggle', applies: c => (c.descLower.includes('pan') && !c.esCombo) || c.esCombo, default: () => 'SÍ' },
        { name: 'Carne', type: 'toggle', applies: c => (c.descLower.includes('carne') && !c.esCombo) || c.esCombo, default: () => 'SÍ' },
        { name: 'Pollo Crispy', type: 'toggle', applies: c => (c.descLower.includes('pollo crispy') || c.descLower.includes('pechuga crispy')) && !c.isNuggets && !c.esCombo, default: () => 'SÍ' },
        { name: 'Pollo a la plancha', type: 'toggle', applies: c => c.descLower.includes('pollo') && !c.descLower.includes('pollo crispy') && !c.descLower.includes('pechuga crispy') && !c.isNuggets && !c.esCombo, default: () => 'SÍ' },
        { name: 'Chuleta', type: 'toggle', applies: c => c.descLower.includes('chuleta') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Tocineta', type: 'toggle', applies: c => (c.descLower.includes('tocineta') && !c.nameLower.includes('promo') && !c.esCombo) || c.esComboHouse || c.isDuoSmash, default: () => 'SÍ' },
        { name: 'Queso Americano', type: 'toggle', applies: c => ((c.descLower.includes('queso') || c.descLower.includes('facilista')) && !c.esCombo && !c.isCrispyBowl) || c.esCombo, default: () => 'SÍ' },
        { name: 'Queso Fundido', type: 'toggle', applies: c => (c.descLower.includes('queso') && !c.esCombo && c.isCrispyBowl) || c.esComboHouse, default: () => 'SÍ' },
        { name: 'Cebolla', type: 'toggle', applies: c => (c.descLower.includes('cebolla') && !c.esCombo) || c.isDuoSmash, default: () => 'SÍ' },
        { name: 'Pepinillos', type: 'toggle', applies: c => c.descLower.includes('pepinillo') && !c.nameLower.includes('smash house') && !c.isDuoSmash && !c.esCombo, default: () => 'SÍ' },
        { name: 'Lechuga', type: 'toggle', applies: c => (c.descLower.includes('lechuga') && !c.esCombo) || c.esComboHouse, default: () => 'SÍ' },
        { name: 'Mayonesa', type: 'toggle', applies: c => c.descLower.includes('mayonesa') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Salsa de la Casa', type: 'toggle', applies: c => (c.descLower.includes('salsa de la casa') && !c.esCombo) || c.esCombo, default: () => 'SÍ' },
        { name: 'Salsa BBQ', type: 'toggle', applies: c => c.descLower.includes('barbecue') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Huevito Sorpresa', type: 'toggle', applies: c => c.descLower.includes('huevito sorpresa') && !c.esCombo, default: () => 'SÍ' }
    ];

    const getCaracasDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: CONFIG.TIMEZONE }));
    const minutesSinceMidnight = (date) => date.getHours() * 60 + date.getMinutes();
    const isMinutesInRange = (mins, start, end) => mins >= start && mins <= end;

    const isStoreOpenNow = () => {
        const caracas = getCaracasDate();
        const day = caracas.getDay();
        const mins = minutesSinceMidnight(caracas);
        if (day >= 1 && day <= 5) {
            return isMinutesInRange(mins, CONFIG.WEEKDAY_OPEN, CONFIG.WEEKDAY_CLOSE);
        }
        return isMinutesInRange(mins, CONFIG.WEEKEND_OPEN, CONFIG.WEEKDAY_CLOSE);
    };

    const isPromoWindowActive = () => {
        const day = getCaracasDate().getDay();
        return day >= 1 && day <= 3; // Lunes (1) a Miércoles (3)
    };

    const parsePrice = (priceStr) => parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const lockBodyScroll = (locked) => { document.body.style.overflow = locked ? 'hidden' : 'auto'; };

    const showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };


    const triggerFlyToCart = (sourceImgId) => {
        const sourceImg = document.getElementById(sourceImgId);
        const cartBtn = document.getElementById('cart-floating-btn');
        if (!sourceImg || !cartBtn) return;

        const rect = sourceImg.getBoundingClientRect();
        const cartRect = cartBtn.getBoundingClientRect();
        const hasValidCartPos = cartRect.top !== 0 || cartRect.left !== 0;
        const targetX = hasValidCartPos ? (cartRect.left + cartRect.width / 2) : (window.innerWidth - 50);
        const targetY = hasValidCartPos ? (cartRect.top + cartRect.height / 2) : 50;

        const flyImg = document.createElement('img');
        flyImg.src = sourceImg.src;
        flyImg.className = 'product-fly-particle';
        flyImg.style.width = `${rect.width}px`;
        flyImg.style.height = `${rect.height}px`;
        flyImg.style.top = `${rect.top}px`;
        flyImg.style.left = `${rect.left}px`;
        document.body.appendChild(flyImg);

        flyImg.offsetWidth;
        const diffX = targetX - (rect.left + rect.width / 2);
        const diffY = targetY - (rect.top + rect.height / 2);

        flyImg.style.transform = `translate(${diffX}px, ${diffY}px) scale(0.1) rotate(25deg)`;
        flyImg.style.opacity = '0';
        setTimeout(() => flyImg.remove(), 750);
    };

    window.registrarVisitaFirebase = () => {
        // Si el usuario no está autenticado, esperamos al evento que lo confirma.
        if (!firebase?.auth?.()?.currentUser) {
            console.log('⏳ Auth no lista. Esperando evento firebase-auth-ready...');
            document.addEventListener('firebase-auth-ready', window.registrarVisitaFirebase, { once: true });
            return;
        }

        // Si llegamos aquí, el usuario ya está autenticado.
        try {
            const db = firebase.database();
            const userUID = firebase.auth().currentUser.uid;

            // --- 1. LÓGICA DE VISITANTES GENERALES ---
            const counterRef = db.ref('stats/unique_visitors_count');
            if (!localStorage.getItem('bh_visitor_registered')) {
                console.log('🔵 Registrando visitante general...');
                counterRef.transaction((currentValue) => (currentValue || 0) + 1, (error, committed) => {
                    if (committed) {
                        localStorage.setItem('bh_visitor_registered', 'true');
                    }
                });
            }

        } catch (err) {
            console.error("Error Firebase contador:", err);
        }
    };

    function verificarYMostrarPromo() {
        const promoModal = document.getElementById('modal-promo-lunes-miercoles');
        if (!promoModal || !isPromoWindowActive()) return;
        promoModal.classList.add('active');
        lockBodyScroll(true);
    }

    function mostrarTarjetasPromo() {
        const promoItems = document.querySelectorAll('.promo-item');
        const isPromoDay = isPromoWindowActive();

        promoItems.forEach(item => {
            if (isPromoDay) {
                item.classList.add('visible');
            } else {
                item.classList.remove('visible');
            }
        });
    }

    function verificarYMostrarPromoPapa() {
        const promoPapaModal = document.getElementById('modal-promo-papa');
        if (!promoPapaModal) return;

        // Solo mostrar hoy (21 de junio de 2026)
        const hoy = new Date();
        const fechaPromo = new Date(2026, 5, 21); // Mes 5 = junio (0-indexed)

        if (hoy.toDateString() === fechaPromo.toDateString()) {
            promoPapaModal.classList.add('active');
            lockBodyScroll(true);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        /* ——— Preloader ——— */
        const preloaderProgress = document.getElementById('preloader-progress');
        const stickyNav = document.querySelector('.sticky-nav');

        const finalizarCarga = () => {
            if (!preloaderProgress || preloaderProgress.dataset.finished === 'true') return;
            preloaderProgress.dataset.finished = 'true';
            preloaderProgress.style.width = '100%';

            setTimeout(() => {
                document.getElementById('preloader')?.classList.add('ocultar');
                document.getElementById('main-menu')?.classList.add('mostrar-menu');

                if (typeof gtag === 'function') {
                    gtag('event', 'menu_ready', { 'event_category': 'Engagement', 'event_label': 'Carga Completa' });
                }

                stickyNav?.classList.add('mostrar-menu');
                document.getElementById('cart-floating-btn')?.classList.remove('cart-btn-hidden');

                // Mostrar modal de promos después de 3s para todos los usuarios
                setTimeout(verificarYMostrarPromo, 3000);
                setTimeout(verificarYMostrarPromoPapa, 3000);

                // Mostrar tarjetas de promo según día
                mostrarTarjetasPromo();
            }, 200);
        };

        const imgs = Array.from(document.querySelectorAll('img:not([loading="lazy"])'));
        let cargadas = 0;
        const total = imgs.length;

        const incrementarProgreso = () => {
            if (!preloaderProgress || preloaderProgress.dataset.finished === 'true') return;
            cargadas++;
            preloaderProgress.style.width = `${Math.min((cargadas / total) * 100, 99)}%`;
            if (cargadas >= total) finalizarCarga();
        };

        if (total === 0) finalizarCarga();
        else {
            imgs.forEach((img) => {
                if (img.complete) incrementarProgreso();
                else {
                    img.addEventListener('load', incrementarProgreso);
                    img.addEventListener('error', incrementarProgreso);
                }
            });
        }

        setTimeout(() => {
            if (preloaderProgress?.dataset.finished !== 'true') finalizarCarga();
        }, CONFIG.PRELOADER_FALLBACK_MS);

        /* ——— Horario / tienda cerrada ——— */
        let isPreOrder = false;
        history.pushState({ mainMenu: true }, '');

        const verificarHorario = () => {
            if (isStoreOpenNow()) return;
            document.getElementById('modal-closed')?.classList.add('active');
            lockBodyScroll(true);
            isPreOrder = true;
        };
        verificarHorario();

        /* ——— Búsqueda y categorías ——— */
        const searchInput = document.getElementById('menu-search');
        searchInput?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const isSearching = term.length > 0;
            const videoFeed = document.getElementById('bh-video-feed-scroll');
            const startOrderText = document.querySelector('.start-order-text');
            const footer = document.querySelector('.bh-footer');
            const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';

            if (isSearching) {
                videoFeed?.classList.add('hidden');
                startOrderText?.classList.add('hidden');
                footer?.classList.add('hidden');
                // Scroll al top del menú para que el viewport no quede en el fondo
                document.getElementById('main-menu')?.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                videoFeed?.classList.toggle('hidden', activeCategory !== 'all');
                startOrderText?.classList.toggle('hidden', activeCategory !== 'all');
                footer?.classList.toggle('hidden', activeCategory !== 'all');
                // Al limpiar la búsqueda, restaurar todas las secciones e items
                document.querySelectorAll('section').forEach((section) => {
                    section.classList.remove('hidden-search');
                    section.querySelectorAll('.menu-item').forEach((item) => item.classList.remove('hidden-search'));
                });
                return;
            }

            document.querySelectorAll('.menu-item').forEach((item) => {
                const name = item.querySelector('.item-name')?.innerText.toLowerCase() ?? '';
                const desc = item.querySelector('.item-desc')?.innerText.toLowerCase() ?? '';
                item.classList.toggle('hidden-search', !(name.includes(term) || desc.includes(term)));
            });
            document.querySelectorAll('section').forEach((section) => {
                const hasVisible = Array.from(section.querySelectorAll('.menu-item')).some(item => !item.classList.contains('hidden-search'));
                section.classList.toggle('hidden-search', !hasVisible);
            });
        });

        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

                const category = btn.dataset.category;
                const footer = document.querySelector('.bh-footer');
                const startOrderText = document.querySelector('.start-order-text');
                if (searchInput) searchInput.value = '';

                document.querySelectorAll('#main-menu section').forEach((section) => {
                    if (category === 'all' || section.id === category) {
                        section.classList.remove('hidden-search');
                        section.querySelectorAll('.menu-item').forEach((item) => item.classList.remove('hidden-search'));
                    } else {
                        section.classList.add('hidden-search');
                    }
                });

                footer?.classList.toggle('hidden', category !== 'all');
                document.getElementById('bh-video-feed-scroll')?.classList.toggle('hidden', category !== 'all');
                startOrderText?.classList.toggle('hidden', category !== 'all');

                if (category === 'all') {
                    setTimeout(() => document.getElementById('main-menu')?.scrollTo({ top: 0, behavior: 'smooth' }), 60);
                } else {
                    const targetSection = document.getElementById(category);
                    if (targetSection) setTimeout(() => targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                }
            });
        });

        /* ——— UI general y modales ——— */
        const helpBtn = document.getElementById('help-btn');
        const modalHelp = document.getElementById('modal-help');

        helpBtn?.addEventListener('click', () => {
            modalHelp.classList.add('active');
            lockBodyScroll(true);
            if (stickyNav) stickyNav.style.display = 'none';
        });

        const cerrarHelp = () => {
            helpBtn?.focus();
            modalHelp?.classList.remove('active');
            lockBodyScroll(false);
            if (stickyNav) stickyNav.style.display = 'block';
        };

        document.getElementById('help-close-btn')?.addEventListener('click', cerrarHelp);
        document.getElementById('btn-close-promo')?.addEventListener('click', () => {
            document.getElementById('modal-promo-lunes-miercoles')?.classList.remove('active');
            lockBodyScroll(false);
        });

        document.getElementById('btn-close-promo-papa')?.addEventListener('click', () => {
            document.getElementById('modal-promo-papa')?.classList.remove('active');
            lockBodyScroll(false);
        });

        document.getElementById('btn-promo-ordenar')?.addEventListener('click', () => {
            document.getElementById('modal-promo-lunes-miercoles')?.classList.remove('active');
            lockBodyScroll(false);

            // Ir al menú de hamburguesas
            const hamburguesasBtn = document.querySelector('.category-btn[data-category="hamburguesas"]');
            if (hamburguesasBtn) {
                hamburguesasBtn.click();
            }
        });

        // Botón volver al menú
        document.getElementById('btn-volver-menu')?.addEventListener('click', () => {
            if (window.history.state?.ui === 'checkout') history.go(-2);
            else if (window.history.state?.ui === 'cart') history.back();
            else cartSidebar?.classList.add('cart-closed');
            lockBodyScroll(false);
            if (stickyNav) stickyNav.style.display = 'block';
        });

        // Event listeners para pestañas de combo house
        document.querySelectorAll('.combo-tab').forEach((tab, index) => {
            tab.addEventListener('click', () => {
                switchComboBurger(index);
            });
        });

        // Interruptores de selección de burger en promos
        document.querySelectorAll('.promo-burger-card:not(#promo-combo-option)').forEach(card => {
            card.addEventListener('click', () => {
                // Remover clase selected de todos los burgers (no combo)
                document.querySelectorAll('.promo-burger-card:not(#promo-combo-option)').forEach(c => c.classList.remove('selected'));
                // Agregar clase selected al clickeado
                card.classList.add('selected');

                // Cambiar imagen
                const imgSrc = card.dataset.imgSrc;
                const promoImg = document.getElementById('modal-promo-img');
                if (promoImg && imgSrc) promoImg.src = imgSrc;

                // Actualizar valor del toggle
                const qtyVal = card.querySelector('.extra-qty-val');
                if (qtyVal) {
                    document.querySelectorAll('.promo-burger-card:not(#promo-combo-option) .extra-qty-val').forEach(v => v.innerText = 'NO');
                    qtyVal.innerText = 'SÍ';
                }

                // Actualizar precio si es combo
                updatePromoPrice();
            });
        });

        // Interruptor de combo
        document.getElementById('promo-combo-option')?.addEventListener('click', function () {
            this.classList.toggle('selected');
            const qtyVal = this.querySelector('.extra-qty-val');
            if (qtyVal) {
                qtyVal.innerText = this.classList.contains('selected') ? 'SÍ' : 'NO';
            }
            updatePromoPrice();
        });

        // Botón de cerrar modal de selección de promos
        document.getElementById('close-promo-selection')?.addEventListener('click', () => {
            document.getElementById('modal-promo-selection')?.classList.remove('active');
            lockBodyScroll(false);
        });

        // Función para actualizar precio de promo
        function updatePromoPrice() {
            const comboOption = document.getElementById('promo-combo-option');
            const isCombo = comboOption?.classList.contains('selected');
            const priceSpan = document.getElementById('promo-selection-price');
            if (priceSpan) {
                const basePrice = isCombo ? CONFIG.PROMO_COMBO_PRICE : CONFIG.PROMO_BASE_PRICE;
                priceSpan.innerHTML = `$${basePrice.toFixed(2)} <span class="modal-ref">REF</span>`;
            }
        }

        // Botón de agregar promo al carrito
        document.getElementById('btn-add-promo-to-cart')?.addEventListener('click', () => {
            const selectedBurger = document.querySelector('.promo-burger-card.selected');
            const isCombo = document.getElementById('promo-combo-option')?.classList.contains('selected');

            if (!selectedBurger) {
                showToast('Selecciona una burger primero', 'error');
                return;
            }

            const burgerName = selectedBurger.dataset.burger;
            const basePrice = isCombo ? CONFIG.PROMO_COMBO_PRICE : CONFIG.PROMO_BASE_PRICE;

            // Extras para el combo
            const extras = [];
            if (isCombo) {
                extras.push({
                    nombre: 'Lata',
                    qty: 1,
                    val: '1',
                    isToggle: false,
                    precio: 0
                });
            }

            const btn = document.getElementById('btn-add-promo-to-cart');
            const spinner = btn?.querySelector('.btn-spinner');
            const textSpan = btn?.querySelector('.btn-text');
            if (btn) btn.style.pointerEvents = 'none';
            if (spinner) spinner.classList.add('active');
            if (textSpan) textSpan.innerText = 'Añadiendo...';

            setTimeout(() => {
                // Agregar al carrito
                carrito.push({
                    id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                    nombre: burgerName + (isCombo ? ' (Promo Combo)' : ' (Promo)'),
                    cantidad: 1,
                    precioUnitario: basePrice,
                    extras: extras,
                    subtotal: basePrice
                });

                actualizarInterfazCarrito();
                document.getElementById('modal-promo-selection')?.classList.remove('active');
                lockBodyScroll(false);
                abrirCarritoConFeedback();

                // Restaurar botón
                if (btn) btn.style.pointerEvents = 'auto';
                if (spinner) spinner.classList.remove('active');
                if (textSpan) textSpan.innerText = 'Añadir al pedido';
            }, 350); // Animación de 350ms
        });

        const menu = document.getElementById('main-menu');
        const modal = document.getElementById('modal-hamburguesa');
        const modalTitle = document.querySelector('.modal-title');
        const modalDesc = document.querySelector('.modal-description');
        const modalPrice = document.querySelector('.modal-price');
        const modalImg = document.getElementById('modal-img');
        const mainQtyVal = document.getElementById('main-qty-val');
        const extrasContainer = document.querySelector('.modal-extras-container');
        const extrasGrid = document.querySelector('.extras-grid');
        const cartBtn = document.getElementById('cart-floating-btn');
        const cartSidebar = document.getElementById('cart-sidebar');
        const cartBadge = document.getElementById('cart-badge');
        const cartItemsContainer = document.getElementById('cart-items-container');
        const cartGrandTotal = document.getElementById('cart-grand-total');
        const cartItemsView = document.getElementById('cart-items-view');
        const checkoutView = document.getElementById('checkout-view');
        const btnAddOrderMain = modal?.querySelector('.btn-add-order');

        let basePrice = 0;
        let currentMainQty = 1;
        let esHamburguesa = false;
        let esComboHouse = false;
        let currentDeliveryMethod = 'delivery';
        let pedidoConfirmado = false;

        const setDeliveryMethod = (method) => {
            currentDeliveryMethod = method;
            document.getElementById('btn-mode-delivery')?.classList.toggle('active', method === 'delivery');
            document.getElementById('btn-mode-pickup')?.classList.toggle('active', method === 'pickup');
            document.getElementById('delivery-tools')?.classList.toggle('hidden', method !== 'delivery');
            document.getElementById('pickup-location-info')?.classList.toggle('hidden', method === 'delivery');
            document.getElementById('additional-notes')?.classList.toggle('hidden', method !== 'delivery');
            document.querySelector('.delivery-notice-premium')?.classList.toggle('hidden', method !== 'delivery');
        };

        document.getElementById('btn-mode-delivery')?.addEventListener('click', () => setDeliveryMethod('delivery'));
        document.getElementById('btn-mode-pickup')?.addEventListener('click', () => setDeliveryMethod('pickup'));

        let carrito = JSON.parse(localStorage.getItem('bh_cart') || '[]');
        let cuponActivo = JSON.parse(localStorage.getItem('bh_cupon_activo') || 'null');
        if (carrito.length > 0) actualizarInterfazCarrito();

        // --- SISTEMA DE CUPONES ---
        const aplicarCupon = async () => {
            const input = document.getElementById('coupon-input');
            const codigo = input.value.toUpperCase().trim();

            if (!codigo) {
                showToast('❌ Ingresa un código', 'error');
                return;
            }

            // Verificar si ya hay un cupón activo
            if (cuponActivo) {
                showToast('⚠️ Ya tienes un cupón aplicado. Elimínalo primero.', 'error');
                return;
            }

            const user = firebase.auth().currentUser;
            if (!user) {
                showToast('❌ Debes iniciar sesión para usar cupones', 'error');
                return;
            }

            try {
                const db = firebase.database();

                // Verificar si el cupón ya fue usado globalmente
                const cuponUsadoRef = db.ref('cupones_usados/' + codigo);
                const cuponUsadoSnap = await cuponUsadoRef.once('value');

                if (cuponUsadoSnap.exists()) {
                    showToast('❌ Este cupón ya fue canjeado por alguien más', 'error');
                    return;
                }

                // Verificar si el cupón existe
                const cuponRef = db.ref('cupones/' + codigo);
                const cuponSnap = await cuponRef.once('value');

                if (!cuponSnap.exists()) {
                    showToast('❌ Código inválido', 'error');
                    return;
                }

                const porcentaje = cuponSnap.val().descuento;

                // Registrar el uso INMEDIATAMENTE con UID y timestamp
                await db.ref('cupones_usados/' + codigo).set({
                    usadoPor: user.uid,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                // Calcular monto a descontar
                const subtotal = carrito.reduce((sum, item) => sum + item.subtotal, 0);
                const montoDescontado = subtotal * (porcentaje / 100);

                cuponActivo = { codigo, porcentaje, monto: montoDescontado };

                // Guardar en localStorage
                localStorage.setItem('bh_cupon_activo', JSON.stringify(cuponActivo));

                // Actualizar UI del carrito
                actualizarInterfazCarrito();

                showToast('🎉 Cupón aplicado', 'success');
                input.value = '';
            } catch (error) {
                console.error('Error al aplicar cupón:', error);
                showToast('❌ Error al aplicar cupón', 'error');
            }
        };

        document.getElementById('btn-apply-coupon')?.addEventListener('click', aplicarCupon);

        // Función para eliminar cupón activo
        const eliminarCupon = () => {
            cuponActivo = null;
            localStorage.removeItem('bh_cupon_activo');
            actualizarInterfazCarrito();
            showToast('🗑️ Cupón eliminado', 'info');
        };

        document.getElementById('btn-remove-coupon')?.addEventListener('click', eliminarCupon);

        const cerrarFunc = () => {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal && activeModal.id !== 'modal-closed') {
                history.back();
            } else {
                modal?.classList.remove('active');
                document.getElementById('modal-reminder')?.classList.remove('active');
                if (stickyNav && cartSidebar?.classList.contains('cart-closed')) stickyNav.style.display = 'block';
                lockBodyScroll(false);
                if (menu) menu.style.overflow = '';
            }
        };

        function syncUIWithState() {
            const state = window.history.state;
            const activeModal = document.querySelector('.modal.active');

            if (state?.ui === 'cart') {
                if (stickyNav) stickyNav.style.display = 'none';
                cartSidebar?.classList.remove('cart-closed');
                cartItemsView?.classList.remove('hidden');
                checkoutView?.classList.add('hidden');
                lockBodyScroll(true);
                toggleCartBackdrop(true);
            } else if (state?.ui === 'checkout') {
                if (stickyNav) stickyNav.style.display = 'none';
                cartSidebar?.classList.remove('cart-closed');
                cartItemsView?.classList.add('hidden');
                checkoutView?.classList.remove('hidden');
                lockBodyScroll(true);
                toggleCartBackdrop(true);
            } else {
                cartSidebar?.classList.add('cart-closed');
                if (stickyNav) stickyNav.style.display = 'block';
                if (!activeModal) lockBodyScroll(false);
                toggleCartBackdrop(false);
            }

            if (activeModal && state?.ui !== 'modal') {
                activeModal.classList.remove('active');
                if (!state?.ui) lockBodyScroll(false);
                if (stickyNav) stickyNav.style.display = 'block';
            }
            if (menu) menu.style.overflow = (state?.ui ? 'hidden' : '');
        }

        function abrirCarritoConFeedback() {
            if (window.history.state?.ui !== 'cart' && window.history.state?.ui !== 'checkout') {
                history.pushState({ ui: 'cart' }, '');
            }
            syncUIWithState();
            setTimeout(() => {
                cartBtn?.classList.add('pulse-animation');
                setTimeout(() => cartBtn?.classList.remove('pulse-animation'), 1000);
            }, 300);
        }

        // Activar/desactivar backdrop del carrito en desktop
        function toggleCartBackdrop(show) {
            const backdrop = document.getElementById('cart-backdrop');
            if (backdrop && window.innerWidth >= 769) {
                if (show) {
                    backdrop.classList.add('active');
                } else {
                    backdrop.classList.remove('active');
                }
            }
        }

        function actualizarInterfazCarrito() {
            const totalItems = carrito.length;
            if (cartBadge) {
                cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
                cartBadge.innerText = String(totalItems);
            }
            if (cartItemsContainer) cartItemsContainer.innerHTML = '';

            let total = 0;
            if (carrito.length === 0) {
                checkoutView?.classList.add('hidden');
                cartItemsView?.classList.remove('hidden');
            }
            localStorage.setItem('bh_cart', JSON.stringify(carrito));

            carrito.forEach((item) => {
                total += item.subtotal;

                let extrasHtmlParts = [];
                if (item.extras?.length > 0) {
                    const sinExtras = item.extras.filter(ex => ex.isToggle && ex.val === 'NO');
                    const extrasAgregados = item.extras.filter(ex =>
                        (!ex.isToggle && ex.qty > 0) || (ex.isToggle && ex.val === 'SÍ')
                    );

                    extrasAgregados.forEach(ex => {
                        // Eliminar "Extra " y "Servicio de " de los nombres
                        // Para combo house, mantener el formato "Hamburguesa X: Extra Nombre"
                        let cleanName = ex.nombre;
                        // Solo limpiar si no es formato de combo house
                        if (!cleanName.includes('Hamburguesa')) {
                            cleanName = cleanName.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                        } else {
                            // Para combo house, aplicar colores a las partes
                            const parts = cleanName.split(', ');
                            const coloredParts = parts.map(part => {
                                if (part.includes('Extra')) {
                                    return `<span style="color:#28a745">${part}</span>`;
                                } else if (part.includes('Sin')) {
                                    return `<span style="color:#ff4d4d">${part}</span>`;
                                }
                                return part;
                            });
                            cleanName = coloredParts.join(', ');
                        }
                        extrasHtmlParts.push(`<span style="color:#28a745">• ${cleanName}${ex.qty > 1 ? ` (${ex.qty})` : ''}</span>`);
                    });

                    sinExtras.forEach(ex => {
                        const displayName = ex.nombre;
                        // Solo limpiar si no es formato de combo house
                        let finalName = displayName.includes('Hamburguesa') ? displayName : displayName.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                        extrasHtmlParts.push(`<span style="color:#ff4d4d">• ${finalName}</span>`);
                    });
                }
                const extrasHtml = extrasHtmlParts.join('<br>');

                if (cartItemsContainer) {
                    cartItemsContainer.insertAdjacentHTML('beforeend', `
                        <div class="cart-item-row">
                            <div class="cart-item-info">
                                <h4>${item.cantidad}x ${item.nombre}</h4>
                                <p class="cart-item-extras" style="line-height:1.4; margin-top:4px;">${extrasHtml}</p>
                            </div>
                            <div class="cart-item-right">
                                <div class="cart-price-column">
                                    <span class="cart-item-price">$${item.subtotal.toFixed(2)}</span>
                                    <span class="cart-item-ref">REF</span>
                                </div>
                                <button class="remove-item" data-id="${item.id}">&times;</button>
                            </div>
                        </div>
                    `);
                }
            });

            cartItemsContainer?.querySelectorAll('.remove-item').forEach((btn) => {
                btn.onclick = () => {
                    carrito = carrito.filter((item) => item.id !== btn.getAttribute('data-id'));

                    // Si el carrito queda vacío, limpiar cupón activo
                    if (carrito.length === 0 && cuponActivo) {
                        cuponActivo = null;
                        localStorage.removeItem('bh_cupon_activo');
                    }

                    actualizarInterfazCarrito();
                };
            });

            // Recalcular descuento si hay cupón activo
            let totalConDescuento = total;
            if (cuponActivo) {
                const nuevoMontoDescontado = total * (cuponActivo.porcentaje / 100);
                cuponActivo.monto = nuevoMontoDescontado;
                totalConDescuento = total - nuevoMontoDescontado;

                // Mostrar resumen del descuento
                const discountSummary = document.getElementById('discount-summary');
                const discountAmount = document.getElementById('discount-amount');
                const discountPercentage = document.getElementById('discount-percentage');
                const couponCodeDisplay = document.getElementById('coupon-code-display');

                if (discountSummary && discountAmount && discountPercentage && couponCodeDisplay) {
                    discountSummary.classList.remove('hidden');
                    discountAmount.textContent = `-$${nuevoMontoDescontado.toFixed(2)}`;
                    discountPercentage.textContent = `-${cuponActivo.porcentaje}%`;
                    couponCodeDisplay.textContent = cuponActivo.codigo;
                }
            } else {
                // Ocultar resumen del descuento si no hay cupón
                document.getElementById('discount-summary')?.classList.add('hidden');
            }

            if (cartGrandTotal) cartGrandTotal.innerHTML = `$${totalConDescuento.toFixed(2)} <span class="cart-ref-total">REF</span>`;
        }

        cartBtn?.addEventListener('click', () => {
            if (window.history.state?.ui !== 'cart') history.pushState({ ui: 'cart' }, '');
            syncUIWithState();
        });

        document.getElementById('close-cart')?.addEventListener('click', () => {
            if (window.history.state?.ui === 'checkout') history.go(-2);
            else if (window.history.state?.ui === 'cart') history.back();
            else cartSidebar?.classList.add('cart-closed');
        });

        document.getElementById('btn-ver-bebidas')?.addEventListener('click', () => {
            if (window.history.state?.ui === 'cart') history.back();
            else {
                cartSidebar?.classList.add('cart-closed');
                if (stickyNav) stickyNav.style.display = 'block';
                lockBodyScroll(false);
                if (menu) menu.style.overflow = '';
            }
            setTimeout(() => document.querySelector('.category-btn[data-category="bebidas"]')?.click(), 350);
        });

        document.querySelector('.close-modal')?.addEventListener('click', cerrarFunc);

        function updateTotal() {
            if (!modal || !modalPrice) return;
            let extraTotal = 0;
            const modalTitleText = document.querySelector('.modal-title')?.innerText.toLowerCase() || '';
            const isComboHouse = modalTitleText.includes('combo house');

            if (isComboHouse) {
                // Asegurarse de que el estado de la hamburguesa actual esté guardado antes de calcular el total
                const currentBurger = comboHouseState.burgers[comboHouseState.activeBurgerIndex];
                modal.querySelectorAll('.extra-card').forEach((card) => {
                    const extraName = card.dataset.extraName;
                    const isToggle = card.dataset.isToggle === 'true';
                    const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                    const val = isToggle ? (valText === 'SÍ' ? 'SÍ' : 'NO') : parseInt(valText, 10) || 0;

                    if (isToggle) {
                        currentBurger.ingredientes[extraName] = val;
                    } else {
                        currentBurger.extras[extraName] = val;
                    }
                });

                // Calcular el total de extras sumando los extras de todas las hamburguesas en comboHouseState
                comboHouseState.burgers.forEach(burger => {
                    Object.entries(burger.extras).forEach(([extraName, qty]) => {
                        if (qty > 0) {
                            const extraDef = EXTRAS_DB.find(ex => ex.name === extraName);
                            if (extraDef) {
                                extraTotal += extraDef.price * qty;
                            }
                        }
                    });
                });
            } else {
                // Lógica existente para ítems individuales
                modal.querySelectorAll('.extra-card').forEach((card) => {
                    const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                    const qty = valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;
                    const extraPriceValue = parseFloat(card.dataset.extraPrice || '0');
                    extraTotal += qty * extraPriceValue;
                });
            }
            const finalTotal = ((basePrice + extraTotal) * currentMainQty) || basePrice || 0;
            modalPrice.innerHTML = `$${finalTotal.toFixed(2)} <span class="modal-ref">REF</span>`;
            btnAddOrderMain?.classList.remove('btn-highlight');
        }
        // Exponer al scope del IIFE para que switchComboBurger pueda invocarla
        _updateTotal = updateTotal;

        /* --- APERTURA DE MODAL DATA-DRIVEN --- */
        document.querySelectorAll('.menu-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                if (stickyNav) stickyNav.style.display = 'none';

                const name = item.querySelector('.item-name')?.textContent.trim() ?? '';
                const desc = item.querySelector('.item-desc')?.textContent.trim() ?? '';
                basePrice = parsePrice(item.querySelector('.item-price')?.innerText ?? '0');

                const nameLower = name.toLowerCase();
                const descLower = desc.toLowerCase();
                const esKids = !!item.closest('#kids');
                esHamburguesa = !!item.closest('#hamburguesas') || !!item.closest('#ensaladas') || esKids || nameLower === 'crispy bowl';
                const isComboHouse4 = nameLower.includes('combo house');
                const isDuoSmash = nameLower.includes('duo smash') || nameLower.includes('dúo smash');
                esComboHouse = isComboHouse4 || isDuoSmash;
                const comboBurgerCount = isDuoSmash ? 2 : (isComboHouse4 ? 4 : 0);
                const esBebida = !!item.closest('#bebidas');

                modal?.querySelector('.modal-content')?.classList.toggle('food-modal', !esBebida);
                if (modalTitle) modalTitle.innerText = name;
                if (modalDesc) modalDesc.innerText = desc;
                if (modalPrice) modalPrice.innerHTML = `$${basePrice.toFixed(2)} <span class="modal-ref">REF</span>`;

                currentMainQty = 1;
                if (mainQtyVal) mainQtyVal.innerText = String(currentMainQty);
                const qtyContainer = modal?.querySelector('.modal-main-qty');
                if (qtyContainer) qtyContainer.style.display = esBebida ? 'block' : 'none';

                // Resetear estado del combo house al abrir modal
                if (esComboHouse) {
                    comboHouseState = {
                        activeBurgerIndex: 0,
                        burgers: Array.from({ length: comboBurgerCount }, (_, i) => ({ id: i + 1, ingredientes: {}, extras: {} }))
                    };
                    updateComboTabsUI();
                }

                // Generación Dinámica de Extras ESTRICTA basada en texto de descripción
                if (extrasGrid) {
                    // Mostrar pestañas si es combo house o duo smash
                    const comboTabs = document.getElementById('combo-tabs');
                    if (comboTabs) {
                        if (esComboHouse) {
                            comboTabs.classList.remove('hidden');
                        } else {
                            comboTabs.classList.add('hidden');
                        }
                    }

                    const ctx = {
                        nameLower, descLower, esHamburguesa, esKids, esCombo: esComboHouse, esComboHouse: isComboHouse4, isDuoSmash,
                        isNuggets: nameLower.includes('nuggets'),
                        isCrispyBowl: nameLower === 'crispy bowl',
                        isPolloCrispy: descLower.includes('pollo crispy'),
                        isPolloNormal: descLower.includes('pollo') && !descLower.includes('pollo crispy'),
                        hasChuleta: descLower.includes('chuleta')
                    };

                    const applicableExtras = EXTRAS_DB.filter(ex => ex.applies(ctx)); // Filtra todos los extras que aplican
                    const toggleExtras = applicableExtras.filter(ex => ex.type === 'toggle'); // Separa los toggles
                    const costExtras = applicableExtras.filter(ex => ex.type === 'cost'); // Separa los extras con costo

                    // Para promos, poner "Papitas + Lata" primero
                    let orderedExtras;
                    if (ctx.nameLower.includes('promo')) {
                        const promoCombo = costExtras.find(ex => ex.name === 'Papitas + Lata');
                        const otherCostExtras = costExtras.filter(ex => ex.name !== 'Papitas + Lata');
                        orderedExtras = promoCombo ? [promoCombo, ...toggleExtras, ...otherCostExtras] : [...toggleExtras, ...costExtras];
                    } else {
                        orderedExtras = [...toggleExtras, ...costExtras]; // Une, poniendo los toggles primero
                    }

                    let extrasHTML = '';

                    if (esComboHouse) {
                        // Para combo house, separar en dos secciones claras
                        extrasHTML += `
                            <div class="extras-section">
                                <h4 class="extras-section-title">Ingredientes Base</h4>
                                <div class="extras-grid">
                                    ${toggleExtras.map(ex => {
                            const defaultVal = (ex.default && typeof ex.default === 'function') ? ex.default(ctx) : 'SÍ'; // Manejar función default
                            const isSelected = defaultVal === 'SÍ';
                            return `
                                        <div class="extra-card ${isSelected ? 'selected' : ''}" data-extra-price="0" data-is-toggle="true" data-extra-name="${ex.name}">
                                            <div class="extra-info-text">
                                                <span class="extra-name">${ex.name}</span>
                                            </div>
                                            <div class="toggle-switch">
                                                <span class="toggle-indicator"></span>
                                            </div>
                                            <span class="extra-qty-val hidden">${defaultVal}</span>
                                        </div>`;
                        }).join('')}
                                </div>
                            </div>
                            <div class="extras-section">
                                <h4 class="extras-section-title">Extras (Costo Adicional)</h4>
                                <div class="extras-grid">
                                    ${costExtras.map(ex => {
                            return `
                                        <div class="extra-card" data-extra-price="${ex.price}" data-is-toggle="false" data-extra-name="${ex.name}">
                                            <div class="extra-info-text">
                                                <span class="extra-name">${ex.name}</span> <span class="extra-cost">+$${ex.price.toFixed(2)}</span>
                                            </div>
                                            <div class="extra-counter">
                                                <button class="extra-qty-btn minus">-</button>
                                                <span class="extra-qty-val">0</span>
                                                <button class="extra-qty-btn plus">+</button>
                                            </div>
                                        </div>`;
                        }).join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        // Para productos normales, renderizado estándar
                        extrasHTML = orderedExtras.map(ex => {
                            const isToggle = ex.type === 'toggle';
                            const defaultVal = isToggle ? ((ex.default && typeof ex.default === 'function') ? ex.default(ctx) : 'SÍ') : '0'; // Manejar función default
                            const isSelected = isToggle && defaultVal === 'SÍ';

                            return `
                            <div class="extra-card ${isSelected ? 'selected' : ''}" data-extra-price="${isToggle ? 0 : ex.price}" data-is-toggle="${isToggle}" data-extra-name="${ex.name}">
                                <div class="extra-info-text">
                                    <span class="extra-name">${ex.name}</span>
                                    ${!isToggle && ex.price > 0 ? `<span class="extra-cost">+$${ex.price.toFixed(2)}</span>` : ''}
                                </div>
                                ${isToggle
                                    ? `
                                    <div class="toggle-switch">
                                        <span class="toggle-indicator"></span>
                                    </div>
                                    <span class="extra-qty-val hidden">${defaultVal}</span>`
                                    : `
                                    <div class="extra-counter">
                                        <button class="extra-qty-btn minus">-</button>
                                        <span class="extra-qty-val">${defaultVal}</span>
                                        <button class="extra-qty-btn plus">+</button>
                                    </div>`
                                }
                            </div>`;
                        }).join('');
                    }

                    extrasGrid.innerHTML = extrasHTML;

                    if (extrasContainer) extrasContainer.style.display = orderedExtras.length > 0 ? 'block' : 'none';
                }

                updateTotal();

                const itemImageSrc = item.querySelector('.item-price-wrapper')?.dataset.imgSrc;
                if (modalImg) {
                    modalImg.src = itemImageSrc || 'images/hamburguesa.webp';
                    modalImg.className = '';
                    if (esBebida) modalImg.classList.add('modal-img-bebida');
                    if (esKids || name === 'Pork House' || name === 'Servicio de Papas con Topping' || nameLower.includes('nuggets')) modalImg.classList.add('modal-img-bottom-aligned');
                    if (name === 'Crispy House' || name === 'House Tower') modalImg.classList.add('modal-img-alejar');
                    if (name === 'Junior Crispy') modalImg.classList.add('modal-img-junior-crispy-lower');
                }

                modal?.classList.add('active');
                history.pushState({ ui: 'modal' }, '');
                lockBodyScroll(true);
                if (menu) menu.style.overflow = 'hidden';
                // Forzar scroll al inicio con delay para asegurar renderizado completo
                setTimeout(() => {
                    if (modal) modal.scrollTop = 0;
                }, 50);
            });
        });

        // Event Delegation para botones + y - de los Extras Dinámicos
        extrasGrid?.addEventListener('click', (e) => {
            const card = e.target.closest('.extra-card');
            if (!card) return;

            const isToggle = card.dataset.isToggle === 'true';
            const valSpan = card.querySelector('.extra-qty-val');
            if (!valSpan) return;

            let valueChanged = false;

            // Lógica para Interruptores (Toggles)
            if (isToggle) {
                const modalTitleText = document.querySelector('.modal-title')?.innerText.toLowerCase() || '';
                const isNuggetsContext = modalTitleText.includes('nuggets');
                const isSauce = (card.querySelector('.extra-name')?.innerText || '').toLowerCase().includes('servicio de salsa');

                if (isNuggetsContext && isSauce) {
                    const isCurrentlySelected = card.classList.contains('selected');

                    // Contar otras salsas seleccionadas, excluyendo la actual si ya está seleccionada
                    const otherSelectedSaucesCount = Array.from(extrasGrid.querySelectorAll('.extra-card[data-is-toggle="true"].selected'))
                        .filter(c => c !== card && (c.querySelector('.extra-name')?.innerText || '').toLowerCase().includes('servicio de salsa'))
                        .length;

                    // Si se está intentando activar una tercera salsa
                    if (!isCurrentlySelected && otherSelectedSaucesCount >= 2) {
                        showToast('Puedes seleccionar un máximo de 2 salsas.', 'error');
                        return; // Previene la activación de una tercera salsa
                    }
                    // Si se está desactivando, o si hay menos de 2 salsas seleccionadas, se permite el cambio.
                }

                card.classList.toggle('selected');
                valSpan.innerText = card.classList.contains('selected') ? 'SÍ' : 'NO';
                valueChanged = true;
            }
            // Lógica para Contadores (+/-)
            else if (e.target.classList.contains('extra-qty-btn')) {
                const btn = e.target;
                let currentVal = parseInt(valSpan.innerText, 10) || 0;

                if (btn.classList.contains('plus')) currentVal++;
                else if (btn.classList.contains('minus') && currentVal > 0) currentVal--;

                valSpan.innerText = String(currentVal);
                valueChanged = true;
            }

            if (!valueChanged) return;

            // Lógica especial cruzada para Pepinillos
            const nameText = card.querySelector('.extra-name')?.innerText ?? '';
            if (isToggle && nameText === 'Pepinillos' && valSpan.innerText === 'NO') {
                extrasGrid.querySelectorAll('.extra-card').forEach(c => {
                    if (c.querySelector('.extra-name')?.innerText === 'Extra Pepinillos') c.querySelector('.extra-qty-val').innerText = '0';
                });
            }
            if (!isToggle && nameText === 'Extra Pepinillos' && (parseInt(valSpan.innerText, 10) || 0) > 0) {
                extrasGrid.querySelectorAll('.extra-card').forEach(c => {
                    if (c.querySelector('.extra-name')?.innerText === 'Pepinillos') {
                        c.classList.add('selected');
                        c.querySelector('.extra-qty-val').innerText = 'SÍ';
                    }
                });
            }
            updateTotal();
        });

        document.getElementById('main-plus')?.addEventListener('click', () => {
            currentMainQty++;
            if (mainQtyVal) mainQtyVal.innerText = String(currentMainQty);
            updateTotal();
        });

        document.getElementById('main-minus')?.addEventListener('click', () => {
            if (currentMainQty > 1) currentMainQty--;
            if (mainQtyVal) mainQtyVal.innerText = String(currentMainQty);
            updateTotal();
        });

        btnAddOrderMain?.addEventListener('click', () => {
            if (currentMainQty < 1 || !modal) return;

            // Iniciar animación
            const spinner = btnAddOrderMain.querySelector('.btn-spinner');
            const textSpan = btnAddOrderMain.querySelector('.btn-text');
            btnAddOrderMain.style.pointerEvents = 'none';
            if (spinner) spinner.classList.add('active');
            if (textSpan) textSpan.innerText = 'Añadiendo...';

            triggerFlyToCart('modal-img');

            const extrasSeleccionados = [];

            setTimeout(() => {
                // LÓGICA ESPECIAL PARA COMBO HOUSE
                if (esComboHouse) {
                    // Guardar estado actual de la hamburguesa activa antes de agregar
                    const currentBurger = comboHouseState.burgers[comboHouseState.activeBurgerIndex];
                    modal.querySelectorAll('.extra-card').forEach((card) => {
                        const extraName = card.dataset.extraName;
                        const isToggle = card.dataset.isToggle === 'true';
                        const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                        const val = isToggle ? (valText === 'SÍ' ? 'SÍ' : 'NO') : parseInt(valText, 10) || 0;

                        if (isToggle) {
                            currentBurger.ingredientes[extraName] = val;
                        } else {
                            currentBurger.extras[extraName] = val;
                        }
                    });

                    const allBurgerModifications = []; // Recopilar todas las modificaciones para todas las hamburguesas
                    let totalExtrasCost = 0; // Para sumar el costo de todos los extras en todas las hamburguesas

                    for (let i = 0; i < comboHouseState.burgers.length; i++) {
                        const burger = comboHouseState.burgers[i];
                        const modificationsForThisBurger = [];

                        // Verificar ingredientes base modificados (diferentes del valor por defecto)
                        Object.entries(burger.ingredientes).forEach(([nombre, val]) => {
                            // Obtener el valor por defecto de EXTRAS_DB para comparación
                            const extraDef = EXTRAS_DB.find(ex => ex.name === nombre && ex.type === 'toggle');
                            // Por defecto 'SÍ' si no se encuentra o no tiene función default
                            const defaultValue = (extraDef && typeof extraDef.default === 'function') ? extraDef.default({}) : 'SÍ';
                            if (val !== defaultValue) {
                                modificationsForThisBurger.push(`Sin ${nombre}`);
                            }
                        });

                        // Verificar extras con costo modificados (mayores a 0)
                        Object.entries(burger.extras).forEach(([nombre, qty]) => {
                            if (qty > 0) {
                                const extraDef = EXTRAS_DB.find(ex => ex.name === nombre && ex.type === 'cost');
                                const precioExtra = extraDef ? extraDef.price : 0;
                                totalExtrasCost += precioExtra * qty; // Sumar el costo total de los extras
                                // Evitar redundancia: no agregar "Extra" si el nombre ya empieza con "Extra"
                                const prefijo = /^extra\s/i.test(nombre) ? '' : 'Extra ';
                                modificationsForThisBurger.push(`${prefijo}${nombre}${qty > 1 ? ` x${qty}` : ''}`);
                            }
                        });

                        // Si esta hamburguesa tiene modificaciones, agregarlas a la lista general
                        if (modificationsForThisBurger.length > 0) {
                            allBurgerModifications.push({
                                nombre: `Hamburguesa ${i + 1}: ${modificationsForThisBurger.join(', ')}`,
                                qty: 1,
                                val: 'SÍ',
                                isToggle: false,
                                precio: 0 // El precio ya está contabilizado en totalExtrasCost
                            });
                        }
                    }

                    // Solo agregar las modificaciones de las hamburguesas a extrasSeleccionados si hay alguna
                    if (allBurgerModifications.length > 0) {
                        extrasSeleccionados.push(...allBurgerModifications);
                    }

                    // Agregar Pepsi por defecto (solo presente para Combo House)
                    const currentProductName = modalTitle?.innerText?.toLowerCase() ?? '';
                    if (currentProductName.includes('combo house')) {
                        extrasSeleccionados.push({
                            nombre: '(+ Pepsi 1L)',
                            qty: 1,
                            val: '1',
                            isToggle: false,
                            precio: 0
                        });
                    }

                    // El subtotal ahora debe usar totalExtrasCost
                    const subtotal = (basePrice + totalExtrasCost) * currentMainQty;

                    carrito.push({
                        id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                        nombre: modalTitle?.innerText ?? 'Producto',
                        cantidad: currentMainQty,
                        precioUnitario: basePrice,
                        extras: extrasSeleccionados,
                        subtotal: Number(subtotal.toFixed(2))
                    });
                } else {
                    // LÓGICA NORMAL PARA OTROS PRODUCTOS
                    modal.querySelectorAll('.extra-card').forEach((card) => {
                        const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                        const nombre = card.querySelector('.extra-name')?.innerText ?? '';
                        const isToggle = card.dataset.isToggle === 'true';
                        const qty = valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;

                        // REGLA ESTRICTA: Solo capturar si se modifica el defecto
                        // Para toggles: capturar si es diferente del valor por defecto
                        // Para extras con costo: capturar si qty > 0
                        let isModified = false;
                        if (isToggle) {
                            const extraDef = EXTRAS_DB.find(ex => ex.name === nombre && ex.type === 'toggle');
                            const defaultValue = (extraDef && typeof extraDef.default === 'function') ? extraDef.default({}) : 'SÍ';
                            isModified = valText !== defaultValue;
                        } else {
                            isModified = qty > 0;
                        }

                        if (isModified) {
                            extrasSeleccionados.push({
                                nombre, qty, val: valText, isToggle,
                                precio: (parseFloat(card.dataset.extraPrice || '0') * qty)
                            });
                        }
                    });

                    const subtotal = (basePrice + extrasSeleccionados.reduce((acc, e) => acc + e.precio, 0)) * currentMainQty;

                    carrito.push({
                        id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                        nombre: modalTitle?.innerText ?? 'Producto',
                        cantidad: currentMainQty,
                        precioUnitario: basePrice,
                        extras: extrasSeleccionados,
                        subtotal: Number(subtotal.toFixed(2))
                    });
                }

                actualizarInterfazCarrito();
                cerrarFunc();
                abrirCarritoConFeedback();

                // Restaurar botón para futuras aperturas
                btnAddOrderMain.style.pointerEvents = 'auto';
                if (spinner) spinner.classList.remove('active');
                if (textSpan) textSpan.innerText = 'Añadir al pedido';
            }, 350);
        });

        document.getElementById('btn-go-checkout')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            if (carrito.length === 0) return showToast('Añade algo al carrito primero', 'error');

            const spinner = btn.querySelector('.btn-spinner');
            const textSpan = btn.querySelector('.btn-text');
            btn.style.pointerEvents = 'none';
            if (spinner) spinner.classList.add('active');
            if (textSpan) textSpan.innerText = 'Cargando...';

            setTimeout(() => {
                history.pushState({ ui: 'checkout' }, '');
                syncUIWithState();

                btn.style.pointerEvents = 'auto';
                if (spinner) spinner.classList.remove('active');
                if (textSpan) textSpan.innerText = 'Confirmar Pedido';
            }, 350);
        });

        document.getElementById('btn-back-to-cart')?.addEventListener('click', () => history.back());

        document.getElementById('btn-pre-order')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const spinner = btn.querySelector('.btn-spinner');
            const textSpan = btn.querySelector('.btn-text');
            btn.style.pointerEvents = 'none';
            if (spinner) spinner.classList.add('active');
            if (textSpan) textSpan.innerText = 'Cargando...';

            setTimeout(() => {
                document.getElementById('modal-closed')?.classList.remove('active');
                lockBodyScroll(false);

                btn.style.pointerEvents = 'auto';
                if (spinner) spinner.classList.remove('active');
                if (textSpan) textSpan.innerText = 'Pre-ordenar';
            }, 350);
        });

        /* --- BOTÓN DE UBICACIÓN OPTIMIZADO Y ANTI-CRASH --- */
        const btnLocation = document.getElementById('btn-get-location');
        const inputMaps = document.getElementById('maps');

        if (btnLocation && inputMaps) {
            btnLocation.addEventListener('click', async () => {
                const spinner = btnLocation.querySelector('.btn-spinner');
                const textSpan = btnLocation.querySelector('.btn-text') || btnLocation.querySelector('span');
                const svgIcon = btnLocation.querySelector('.location-icon');

                const originalText = textSpan.innerText;
                textSpan.innerText = 'Buscando...';
                btnLocation.classList.add('loading');
                btnLocation.disabled = true;
                if (spinner) spinner.classList.add('active');
                if (svgIcon) svgIcon.style.display = 'none';

                const resetBtn = () => {
                    textSpan.innerText = originalText;
                    btnLocation.classList.remove('loading');
                    btnLocation.disabled = false;
                    if (spinner) spinner.classList.remove('active');
                    if (svgIcon) svgIcon.style.display = 'block';
                };

                try {
                    // Usar plugin Capacitor si está disponible (APK Android/iOS)
                    // → dispara el diálogo nativo "Permitir ubicación"
                    const CapGeo = window.Capacitor?.Plugins?.Geolocation;

                    let lat, lng;

                    if (CapGeo) {
                        // Pedir permiso explícitamente (solo aparece la 1ra vez)
                        const permResult = await CapGeo.requestPermissions();
                        if (permResult.location === 'denied') {
                            resetBtn();
                            return showToast('Permiso de ubicación denegado. Actívalo en Ajustes > Aplicaciones > Burger House.', 'error');
                        }
                        const pos = await CapGeo.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
                        lat = pos.coords.latitude;
                        lng = pos.coords.longitude;
                    } else {
                        // Fallback web: navigator.geolocation estándar
                        if (!navigator.geolocation) {
                            resetBtn();
                            return showToast('Tu dispositivo no soporta geolocalización.', 'error');
                        }
                        const pos = await new Promise((resolve, reject) =>
                            navigator.geolocation.getCurrentPosition(resolve, reject,
                                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
                        );
                        lat = pos.coords.latitude;
                        lng = pos.coords.longitude;
                    }

                    inputMaps.value = `https://maps.google.com/?q=${lat},${lng}`;
                    inputMaps.classList.add('location-success');
                    setTimeout(() => inputMaps.classList.remove('location-success'), 2000);
                    textSpan.innerText = '¡Ubicación guardada!';
                    btnLocation.classList.remove('loading');
                    btnLocation.disabled = false;
                    if (spinner) spinner.classList.remove('active');
                    if (svgIcon) svgIcon.style.display = 'block';
                    showToast('Ubicación capturada correctamente', 'success');

                } catch (error) {
                    resetBtn();
                    let errorMsg = 'Error al obtener ubicación. Permite el acceso GPS.';
                    if (error.code === 1 || error.message?.includes('denied')) {
                        errorMsg = 'Permiso denegado. Ve a Ajustes > Apps > Burger House > Permisos > Ubicación.';
                    } else if (error.code === 2) {
                        errorMsg = 'Señal GPS débil. Pega tu enlace de Maps manualmente.';
                    } else if (error.code === 3) {
                        errorMsg = 'Tiempo de espera agotado. Pega tu enlace de Maps manualmente.';
                    }
                    showToast(errorMsg, 'error');
                }
            });
        }

        /* --- PROCESO DE PAGO (ANTI-CRASH) --- */
        document.getElementById('form-delivery')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('btn-whatsapp-final');
            const originalBtnText = submitBtn.innerHTML;

            try {
                const nombre = document.getElementById('full-name')?.value.trim() ?? '';
                const notas = document.getElementById('additional-notes')?.value.trim() ?? '';
                const mapsLink = document.getElementById('maps')?.value.trim() ?? '';

                if (carrito.length === 0) throw new Error('El carrito está vacío. Añade productos.');
                if (!nombre) throw new Error('Por favor, ingresa tu nombre completo.');

                const totalPedido = carrito.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                if (totalPedido <= 0) throw new Error('El total del pedido es $0.00.');

                // UI Loading state
                const spinner = submitBtn.querySelector('.btn-spinner');
                const span = submitBtn.querySelector('.btn-text');
                const wIcon = submitBtn.querySelector('.whatsapp-icon');
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.8';
                if (spinner) spinner.classList.add('active');
                if (wIcon) wIcon.style.display = 'none';
                if (span) span.innerText = 'Generando comanda...';

                // 1. GENERACIÓN DE COMANDA ESTRICTA
                let mensaje = `*NUEVO PEDIDO - BURGER HOUSE*\n\n*Cliente:* ${nombre}\n`;
                mensaje += '\n*DETALLE DEL PEDIDO:*\n';
                carrito.forEach((item) => {
                    // Detectar si este item es un Combo House (tiene extras con formato "Hamburguesa X: ...")
                    const esComboHouseItem = item.extras?.some(ex => ex.nombre?.includes('Hamburguesa'));

                    mensaje += `*${item.cantidad}x ${item.nombre}*\n`;

                    if (esComboHouseItem) {
                        // --- FORMATO ESPECIAL COMBO HOUSE ---
                        // Separar modificaciones por hamburguesa y Pepsi
                        const burgerMods = item.extras?.filter(ex => ex.nombre?.includes('Hamburguesa'));
                        const pepsi = item.extras?.find(ex => ex.nombre?.includes('Pepsi'));

                        burgerMods?.forEach(ex => {
                            // ex.nombre tiene formato: "Hamburguesa 2: Sin Carne, Extra Chuleta x2"
                            const colonIdx = ex.nombre.indexOf(': ');
                            if (colonIdx === -1) {
                                mensaje += `   - ${ex.nombre}\n`;
                                return;
                            }
                            const label = ex.nombre.slice(0, colonIdx); // "Hamburguesa 2"
                            const mods = ex.nombre.slice(colonIdx + 2); // "Sin Carne, Extra Chuleta x2"
                            const modList = mods.split(', ').map(m => m.trim()).filter(Boolean);
                            mensaje += `   *${label}:*\n`;
                            modList.forEach(mod => {
                                mensaje += `      - ${mod}\n`;
                            });
                        });

                        if (pepsi) mensaje += `   - ${pepsi.nombre}\n`;

                    } else {
                        // --- FORMATO NORMAL ---
                        const isNuggetsItem = item.nombre.toLowerCase().includes('nuggets');

                        // Filtrar lo que se quitó (Toggles en NO)
                        const sin = item.extras?.filter(ex => ex.isToggle && ex.val === 'NO')
                            .map(ex => ex.nombre.toUpperCase().replace(/^EXTRA\s+/i, ''));

                        // Extras agregados o activados
                        const extrasAgregados = item.extras?.filter(ex => {
                            if (!ex.isToggle) return ex.qty > 0;
                            return ex.val === 'SÍ';
                        }).map(ex => {
                            let cleanName = ex.nombre.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                            return `${cleanName}${ex.qty > 1 ? ` (${ex.qty})` : ''}`;
                        });

                        if (extrasAgregados?.length > 0) mensaje += `   EXTRAS:\n     - ${extrasAgregados.join('\n     - ')}\n`;
                        if (sin?.length > 0) mensaje += `   SIN:\n     - ${sin.join('\n     - ')}\n`;
                    }
                });

                mensaje += '\n------------------------------\n';
                let totalConDescuento = totalPedido;

                if (cuponActivo) {
                    const montoDescontado = totalPedido * (cuponActivo.porcentaje / 100);
                    totalConDescuento = totalPedido - montoDescontado;

                    mensaje += `*SUBTOTAL:* $${totalPedido.toFixed(2)} REF\n`;
                    mensaje += `*CUPÓN MUNDIAL (${cuponActivo.codigo}):* -${cuponActivo.porcentaje}% (-$${montoDescontado.toFixed(2)} REF)\n`;
                    mensaje += `------------------------------\n`;
                    mensaje += `*TOTAL A PAGAR:* $${totalConDescuento.toFixed(2)} REF*\n`;
                } else {
                    mensaje += `*TOTAL DEL PEDIDO: $${totalConDescuento.toFixed(2)} REF*\n`;
                }

                if (currentDeliveryMethod === 'delivery') mensaje += '_(El costo del delivery se calcula al recibir la ubicación)_\n';
                mensaje += '------------------------------\n\n*DATOS DE ENTREGA:*\n';
                mensaje += `*Método:* ${currentDeliveryMethod === 'delivery' ? 'DELIVERY' : 'PICK UP'}\n`;

                if (currentDeliveryMethod === 'delivery') {
                    if (notas) mensaje += `*Notas:* ${notas}\n`;
                    mensaje += `*Ubicación Maps:* ${mapsLink || 'No proporcionada'}\n`;
                } else if (notas) {
                    mensaje += `*Notas:* ${notas}\n`;
                }

                if (isPreOrder) mensaje += '\n\nPROCESAR AL ABRIR';

                const url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

                // 2. GUARDADO EN BASES DE DATOS (Manejo de Errores Aislado)
                // Usamos un bloque interno para que si Firebase falla, NO se bloquee el WhatsApp
                const registrarEnBasesDeDatos = async () => {
                    if (typeof firebase === 'undefined') {
                        console.warn("Firebase no está disponible. Saltando registro en DB para no bloquear WhatsApp.");
                        return Promise.resolve(); // Permite que el flujo siga hacia WhatsApp sin romperse
                    }

                    const fechaActual = new Date().toLocaleString();
                    const productosResumen = carrito.map(item => `${item.cantidad}x ${item.nombre}`).join(', ');

                    // Firebase
                    if (typeof firebase !== 'undefined' && firebase.apps.length) {
                        try {
                            const db = firebase.database();
                            const pedidoData = {
                                cliente: { nombre, metodo: currentDeliveryMethod, notas_referencia: notas, ubicacion_maps: mapsLink },
                                productos: carrito.map(item => ({
                                    nombre: item.nombre,
                                    cantidad: item.cantidad,
                                    precio_unitario: item.precioUnitario,
                                    subtotal: item.subtotal,
                                    detalles_personalizacion: item.extras.map(ex => ({ nombre: ex.nombre, cantidad: ex.qty, opcion: ex.val }))
                                })),
                                total_usd: totalConDescuento,
                                fecha: fechaActual,
                                timestamp: firebase.database.ServerValue.TIMESTAMP,
                                estado: "pendiente"
                            };

                            if (cuponActivo) {
                                pedidoData.cupon_usado = cuponActivo.codigo;
                            }

                            await db.ref('pedidos').push(pedidoData);
                        } catch (err) { console.error("Fallo menor: Firebase no respondió a tiempo", err); }
                    }

                    // Limpiar cupón activo después de enviar pedido
                    if (cuponActivo) {
                        cuponActivo = null;
                        localStorage.removeItem('bh_cupon_activo');
                    }

                    // SheetDB - Comentado para que solo se envíe cuando se aprueba en admin
                    // try {
                    //     await fetch('https://sheetdb.io/api/v1/qyjuou0mbnjhc', {
                    //         method: 'POST',
                    //         headers: { 'Content-Type': 'application/json' },
                    //         body: JSON.stringify({
                    //             data: [{ fecha: fechaActual, cliente: nombre, metodo: currentDeliveryMethod, productos: productosResumen, total: totalConDescuento.toFixed(2), notas: notas || "Sin notas adicionales", ubicacion: mapsLink || "N/A" }]
                    //         })
                    //     });
                    // } catch (err) { console.error("Fallo menor: SheetDB no respondió", err); }
                };

                // Ejecutamos en paralelo sin bloquear la redirección
                registrarEnBasesDeDatos();

                // 3. FINALIZAR ORDEN Y REDIRIGIR
                try { localStorage.removeItem('bh_cart'); } catch (e) { }

                pedidoConfirmado = true;
                history.pushState({ orderSent: true }, '');

                // Limpiar formulario para evitar mensaje de "desea salir de la página"
                const form = document.getElementById('form-delivery');
                if (form) form.reset();

                // Asegurar redirección a WhatsApp siempre sin mensaje de advertencia
                try {
                    window.location.replace(url);
                } catch (e) {
                    // Fallback si window.location.replace falla
                    window.open(url, '_self');
                }

                // Actualizar Interfaz
                cartSidebar?.classList.add('cart-closed');
                document.getElementById('modal-reminder')?.classList.add('active');
                if (stickyNav) stickyNav.style.display = 'none';

            } catch (error) {
                // Captura de Errores Fatales (ej. variables nulas)
                console.error("Error al procesar el pago:", error);
                showToast(error.message || 'Ocurrió un error al procesar la orden', 'error');
            } finally {
                // Siempre devolver el botón a la normalidad, pase lo que pase
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }
            }
        });

        const reloadAfterOrder = (e) => {
            const btn = e?.currentTarget;
            if (btn) {
                const spinner = btn.querySelector('.btn-spinner');
                const textSpan = btn.querySelector('.btn-text') || btn.querySelector('span');
                btn.style.pointerEvents = 'none';
                if (spinner) spinner.classList.add('active');
                if (textSpan) textSpan.innerText = 'Cargando...';
            }
            setTimeout(() => {
                pedidoConfirmado = false;
                window.location.reload();
            }, 350);
        };
        document.getElementById('btn-reminder-ok')?.addEventListener('click', reloadAfterOrder);
        document.getElementById('btn-new-order')?.addEventListener('click', reloadAfterOrder);

        window.addEventListener('click', (e) => {
            if (e.target === modal || e.target === document.getElementById('modal-promo-selection')) cerrarFunc();
        });

        window.addEventListener('popstate', (event) => {
            if (pedidoConfirmado) {
                document.getElementById('modal-reminder')?.classList.add('active');
                history.pushState({ orderSent: true }, '');
            } else syncUIWithState();
        });

        window.addEventListener('beforeunload', (e) => { if (!pedidoConfirmado) e.preventDefault(); });

        // Precargar imágenes de los modales para que se abran instantáneamente
        window.addEventListener('load', () => {
            const preloadUrls = new Set();
            document.querySelectorAll('[data-img-src]').forEach(el => {
                if (el.dataset.imgSrc) preloadUrls.add(el.dataset.imgSrc);
            });
            preloadUrls.forEach(url => {
                const img = new Image();
                img.src = url;
            });
        });
    });
})();