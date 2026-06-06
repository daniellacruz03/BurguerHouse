/**
 * Burger House — lógica de menú, carrito, horarios y geolocalización.
 * Mantiene el mismo comportamiento que el script inline original.
 */
(function () {
    'use strict';

    const CONFIG = {
        TIMEZONE: 'America/Caracas',
        WHATSAPP: '584127510090',
        PRELOADER_FALLBACK_MS: 3000,
        WEEKDAY_OPEN: 1020,
        WEEKDAY_CLOSE: 1350,
        WEEKEND_OPEN: 780,
        PROMO_BASE_PRICE: 6.5,
        PROMO_COMBO_PRICE: 8.5,
        PROMO_COMBO_EXTRA: 2.0,
        // REEMPLAZA ESTO CON TUS CREDENCIALES DE FIREBASE CONSOLE
        FIREBASE_CONFIG: {
            apiKey: "AIzaSyCOIK3Xc_IzKvDc1hmO5aAdLST0KE8f9P8",
            authDomain: "burguer-house-17e76.firebaseapp.com",
            databaseURL: "https://burguer-house-17e76-default-rtdb.firebaseio.com",
            projectId: "burguer-house-17e76",
            storageBucket: "burguer-house-17e76.firebasestorage.app",
            messagingSenderId: "641974770181",
            appId: "1:641974770181:web:5e348815b735d26cb7da6c",
            measurementId: "G-YBR4MCPDXQ"
        }
    };

    // Inicializar Firebase
    if (typeof firebase !== 'undefined' && CONFIG.FIREBASE_CONFIG.apiKey !== "TU_API_KEY") {
        firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    }

    const getCaracasDate = () =>
        new Date(new Date().toLocaleString('en-US', { timeZone: CONFIG.TIMEZONE }));

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
        return day >= 1 && day <= 3; // Lunes (1), Martes (2) o Miércoles (3)
    };

    const parsePrice = (priceStr) =>
        parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

    const lockBodyScroll = (locked) => {
        document.body.style.overflow = locked ? 'hidden' : 'auto';
    };

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

    /**
     * Crea un efecto visual de una imagen "volando" hacia el carrito.
     */
    const triggerFlyToCart = (sourceImgId) => {
        const sourceImg = document.getElementById(sourceImgId);
        const cartBtn = document.getElementById('cart-floating-btn');
        if (!sourceImg || !cartBtn) return;

        const rect = sourceImg.getBoundingClientRect();
        const cartRect = cartBtn.getBoundingClientRect();
        
        // Si el carrito no es visible (está el modal encima), apuntamos a la esquina superior derecha
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

        // Forzar reflow y ejecutar animación
        flyImg.offsetWidth;
        const diffX = targetX - (rect.left + rect.width / 2);
        const diffY = targetY - (rect.top + rect.height / 2);

        flyImg.style.transform = `translate(${diffX}px, ${diffY}px) scale(0.1) rotate(25deg)`;
        flyImg.style.opacity = '0';
        setTimeout(() => flyImg.remove(), 750);
    };

    const registrarVisitaFirebase = () => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) return;
        try {
            const db = firebase.database();
            const counterRef = db.ref('stats/unique_visitors_count');
            if (!localStorage.getItem('bh_visitor_registered')) {
                counterRef.transaction((currentValue) => {
                    return (currentValue || 0) + 1;
                }, (error, committed, snapshot) => {
                    if (error) {
                        console.error("Error en la transacción de Firebase:", error);
                    } else if (committed) {
                        localStorage.setItem('bh_visitor_registered', 'true');
                    }
                });
            }
        } catch (err) {
            console.error("Error al inicializar el contador de Firebase:", err);
        }
    };

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

                // Enviar evento a Google Analytics cuando el menú está listo
                if (typeof gtag === 'function') {
                    gtag('event', 'menu_ready', {
                        'event_category': 'Engagement',
                        'event_label': 'Carga Completa'
                    });
                }

                // Lógica de Firebase para el contador de los primeros 20
                registrarVisitaFirebase();

                stickyNav?.classList.add('mostrar-menu');
                document.getElementById('cart-floating-btn')?.classList.remove('cart-btn-hidden');
                setTimeout(verificarYMostrarPromo, 1000);
            }, 200);
        };

        const imgs = Array.from(document.querySelectorAll('img'));
        let cargadas = 0;
        const total = imgs.length;

        const incrementarProgreso = () => {
            if (!preloaderProgress || preloaderProgress.dataset.finished === 'true') return;
            cargadas++;
            const porcentaje = total > 0 ? (cargadas / total) * 100 : 100;
            preloaderProgress.style.width = `${Math.min(porcentaje, 99)}%`;
            if (cargadas >= total) finalizarCarga();
        };

        if (total === 0) {
            finalizarCarga();
        } else {
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
        let backPressCount = 0;
        
        // Inicializar estado del menú principal para manejo del botón atrás
        history.pushState({ mainMenu: true }, '');

        const verificarHorario = () => {
            if (isStoreOpenNow()) return;
            document.getElementById('modal-closed')?.classList.add('active');
            lockBodyScroll(true);
            isPreOrder = true;
        };

        /* ——— Búsqueda y categorías ——— */
        const searchInput = document.getElementById('menu-search');
        searchInput?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const isSearching = term.length > 0;

            // Ocultar historias y guía de ayuda durante la búsqueda para mejorar el espacio
            const videoFeed = document.getElementById('bh-video-feed-scroll');
            const startOrderText = document.querySelector('.start-order-text');
            const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';

            if (isSearching) {
                videoFeed?.classList.add('hidden');
                startOrderText?.classList.add('hidden');
            } else {
                // Al limpiar la búsqueda, restaurar visibilidad solo si estamos en la categoría "Todos"
                videoFeed?.classList.toggle('hidden', activeCategory !== 'all');
                startOrderText?.classList.toggle('hidden', activeCategory !== 'all');
            }

            document.querySelectorAll('.menu-item').forEach((item) => {
                const name = item.querySelector('.item-name')?.innerText.toLowerCase() ?? '';
                const desc = item.querySelector('.item-desc')?.innerText.toLowerCase() ?? '';
                item.classList.toggle('hidden-search', !(name.includes(term) || desc.includes(term)));
            });
            document.querySelectorAll('section').forEach((section) => {
                const hasVisible = Array.from(section.querySelectorAll('.menu-item')).some(
                    (item) => !item.classList.contains('hidden-search')
                );
                section.classList.toggle('hidden-search', !hasVisible);
            });
        });

        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // Centrar automáticamente la categoría seleccionada en la barra horizontal
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

                const category = btn.dataset.category;
                const footer = document.querySelector('.bh-footer');
                const startOrderText = document.querySelector('.start-order-text');
                if (searchInput) searchInput.value = '';

                document.querySelectorAll('#main-menu section').forEach((section) => {
                    if (category === 'all' || section.id === category) {
                        section.classList.remove('hidden-search');
                        section
                            .querySelectorAll('.menu-item')
                            .forEach((item) => item.classList.remove('hidden-search'));
                    } else {
                        section.classList.add('hidden-search');
                    }
                });

                footer?.classList.toggle('hidden', category !== 'all');
                // Sincronizar visibilidad de videos con la categoría seleccionada
                const videoFeed = document.getElementById('bh-video-feed-scroll');
                videoFeed?.classList.toggle('hidden', category !== 'all');
                // Ocultar botón "Empieza a Pedir" cuando no esté en "Todos"
                startOrderText?.classList.toggle('hidden', category !== 'all');

                if (category === 'all') {
                    // Añadimos un pequeño delay para permitir que el navegador recalcule el layout
                    setTimeout(() => {
                        document.getElementById('main-menu')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 60);
                } else {
                    const targetSection = document.getElementById(category);
                    if (targetSection) {
                        // Pequeño delay para permitir que el filtrado (display: none)
                        // se procese antes de calcular el scroll exacto
                        setTimeout(() => {
                            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 60);
                    }
                }
            });
        });

        /* ——— Promo Lunes–Miércoles ——— */
        function verificarYMostrarPromo() {
            const promoModal = document.getElementById('modal-promo-lunes-miercoles');
            if (!promoModal || !isPromoWindowActive()) return;
            promoModal.classList.add('active');
            lockBodyScroll(true);
        }
        
        /* ——— Modal de Ayuda ——— */
        const helpBtn = document.getElementById('help-btn');
        const modalHelp = document.getElementById('modal-help');
        const helpCloseBtn = document.getElementById('help-close-btn');

        if (helpBtn && modalHelp) {
            helpBtn.addEventListener('click', () => {
                modalHelp.classList.add('active');
                lockBodyScroll(true);
                if (stickyNav) stickyNav.style.display = 'none';
            });
        }

        const cerrarHelp = () => {
            modalHelp?.classList.remove('active');
            lockBodyScroll(false);
            if (stickyNav) stickyNav.style.display = 'block';
        };

        helpCloseBtn?.addEventListener('click', cerrarHelp);
        modalHelp?.addEventListener('click', (e) => {
            if (e.target === modalHelp) cerrarHelp();
        });

        document.getElementById('btn-close-promo')?.addEventListener('click', () => {
            document.getElementById('modal-promo-lunes-miercoles')?.classList.remove('active');
            lockBodyScroll(false);
        });

        /* ——— Referencias DOM principales ——— */
        const menu = document.getElementById('main-menu');
        const modal = document.getElementById('modal-hamburguesa');
        const closeModal = document.querySelector('.close-modal');
        const modalTitle = document.querySelector('.modal-title');
        const modalDesc = document.querySelector('.modal-description');
        const modalPrice = document.querySelector('.modal-price');
        const modalImg = document.getElementById('modal-img');
        const mainQtyVal = document.getElementById('main-qty-val');
        const extrasContainer = document.querySelector('.modal-extras-container');
        const cartBtn = document.getElementById('cart-floating-btn');
        const cartSidebar = document.getElementById('cart-sidebar');
        const closeCart = document.getElementById('close-cart');
        const cartBadge = document.getElementById('cart-badge');
        const cartItemsContainer = document.getElementById('cart-items-container');
        const cartGrandTotal = document.getElementById('cart-grand-total');
        const cartItemsView = document.getElementById('cart-items-view');
        const checkoutView = document.getElementById('checkout-view');
        const modalReminder = document.getElementById('modal-reminder');
        const btnReminderOk = document.getElementById('btn-reminder-ok');
        const btnNewOrder = document.getElementById('btn-new-order');
        const btnUpsellMore = document.getElementById('btn-upsell-more'); // Agregado para upsell

        const btnAddOrderMain = modal?.querySelector('.btn-add-order');
        const modalClosed = document.getElementById('modal-closed');
        const btnPreOrder = document.getElementById('btn-pre-order');

        const modalPromoSelection = document.getElementById('modal-promo-selection');
        const closePromoSelection = document.getElementById('close-promo-selection');
        const promoBurgerCards = document.querySelectorAll('#promo-burger-options .promo-burger-card');
        const promoComboCard = document.getElementById('promo-combo-option');
        const promoPriceDisplay = document.getElementById('promo-selection-price');
        const btnAddPromoToCart = document.getElementById('btn-add-promo-to-cart');

        const updatePromoUI = () => {
            if (!promoComboCard || !promoPriceDisplay) return;
            let total = CONFIG.PROMO_BASE_PRICE;
            const valSpan = promoComboCard.querySelector('.extra-qty-val');
            if (valSpan?.innerText === 'SÍ') total += CONFIG.PROMO_COMBO_EXTRA;
            promoPriceDisplay.innerHTML = `$${total.toFixed(2)} <span class="modal-ref">REF</span>`;
        };

        document.getElementById('btn-promo-ordenar')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('modal-promo-lunes-miercoles')?.classList.remove('active');
            const pModal = document.getElementById('modal-promo-selection');
            if (!pModal) return;
            pModal.classList.add('active');
            lockBodyScroll(true);
            const promoImg = document.getElementById('modal-promo-img');
            if (promoImg) promoImg.src = 'houseclasic.webp';
            updatePromoUI();
        });

        // Manejo de selección de hamburguesa en la promo (Selección única)
        promoBurgerCards.forEach((card) => {
            card.addEventListener('click', () => {
                promoBurgerCards.forEach((c) => {
                    c.classList.remove('selected');
                    const span = c.querySelector('.extra-qty-val');
                    if (span) span.innerText = 'NO';
                });
                card.classList.add('selected');
                const val = card.querySelector('.extra-qty-val');
                if (val) val.innerText = 'SÍ';
                
                const mainImg = document.getElementById('modal-promo-img');
                if (mainImg && card.dataset.imgSrc) mainImg.src = card.dataset.imgSrc;
                updatePromoUI();
            });
        });

        // Manejo de opción de combo en la promo (Toggle/Checkbox)
        promoComboCard?.addEventListener('click', () => {
            const valSpan = promoComboCard.querySelector('.extra-qty-val');
            if (!valSpan) return;
            const isSelected = valSpan.innerText === 'SÍ';
            valSpan.innerText = isSelected ? 'NO' : 'SÍ';
            promoComboCard.classList.toggle('selected', !isSelected);
            updatePromoUI();
        });

        closePromoSelection?.addEventListener('click', () => {
            modalPromoSelection?.classList.remove('active');
            lockBodyScroll(false);
            if (menu) menu.style.overflow = '';
        });

        btnAddPromoToCart?.addEventListener('click', () => {
            const selectedBurgerCard = Array.from(promoBurgerCards).find((c) =>
                c.classList.contains('selected')
            );
            if (!selectedBurgerCard) {
                showToast('Por favor selecciona una hamburguesa.', 'error');
                return;
            }
            const burgerName = selectedBurgerCard.dataset.burger;
            const hasCombo = promoComboCard?.querySelector('.extra-qty-val')?.innerText === 'SÍ';
            const finalPrice = hasCombo ? CONFIG.PROMO_COMBO_PRICE : CONFIG.PROMO_BASE_PRICE;
            const extrasPromo = hasCombo
                ? [
                      {
                          nombre: 'Extra Papitas + Bombita',
                          qty: 1,
                          val: '1',
                          isToggle: false,
                          precio: CONFIG.PROMO_COMBO_EXTRA
                      }
                  ]
                : [];

            carrito.push({
                id: `promo-${Date.now()}`,
                nombre: `PROMO ${burgerName}`,
                cantidad: 1,
                precioUnitario: CONFIG.PROMO_BASE_PRICE,
                extras: extrasPromo,
                subtotal: finalPrice
            });
            actualizarInterfazCarrito();
            triggerFlyToCart('modal-promo-img');
            modalPromoSelection?.classList.remove('active');
            lockBodyScroll(false);
            if (menu) menu.style.overflow = '';
            abrirCarritoConFeedback();
        });

        let basePrice = 0;
        let currentMainQty = 1;
        let esHamburguesa = false;
        let esComboHouse = false;
        let esKids = false;
        let pedidoConfirmado = false;
        let currentDeliveryMethod = 'delivery';

        verificarHorario();

        const btnModeDelivery = document.getElementById('btn-mode-delivery');
        const btnModePickup = document.getElementById('btn-mode-pickup');
        const deliveryTools = document.getElementById('delivery-tools');
        const pickupInfo = document.getElementById('pickup-location-info');
        const deliveryNotice = document.querySelector('.delivery-notice-premium');
        const additionalNotes = document.getElementById('additional-notes');

        const setDeliveryMethod = (method) => {
            currentDeliveryMethod = method;

            if (method === 'delivery') {
                btnModeDelivery?.classList.add('active');
                btnModePickup?.classList.remove('active');
                deliveryTools?.classList.remove('hidden');
                pickupInfo?.classList.add('hidden');
                additionalNotes?.classList.remove('hidden');
                deliveryNotice?.classList.remove('hidden');
            } else {
                btnModePickup?.classList.add('active');
                btnModeDelivery?.classList.remove('active');
                deliveryTools?.classList.add('hidden');
                pickupInfo?.classList.remove('hidden');
                additionalNotes?.classList.add('hidden');
                deliveryNotice?.classList.add('hidden');
            }
            actualizarInterfazCarrito();
        };

        btnModeDelivery && (btnModeDelivery.onclick = () => setDeliveryMethod('delivery'));
        btnModePickup && (btnModePickup.onclick = () => setDeliveryMethod('pickup'));

        let carrito = [];
        try {
            carrito = JSON.parse(localStorage.getItem('bh_cart') || '[]');
            if (!Array.isArray(carrito)) carrito = [];
        } catch {
            carrito = [];
            localStorage.removeItem('bh_cart');
        }

        if (carrito.length > 0) actualizarInterfazCarrito();

        const cerrarFunc = () => {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal && activeModal.id !== 'modal-closed') {
                history.back();
            } else {
                modal?.classList.remove('active');
                modalReminder?.classList.remove('active');
                // Solo mostrar header si el carrito no está abierto
                if (stickyNav && cartSidebar?.classList.contains('cart-closed')) stickyNav.style.display = 'block';
                lockBodyScroll(false);
                if (menu) menu.style.overflow = '';
            }
        };

        function guardarCarrito() {
            try {
                localStorage.setItem('bh_cart', JSON.stringify(carrito));
            } catch (err) {
                console.warn('No se pudo guardar el carrito:', err);
            }
        }

        /**
         * Sincroniza la visibilidad de los componentes (Carrito, Checkout, Modales)
         * basándose exclusivamente en el estado actual del historial.
         */
        function syncUIWithState() {
            const state = window.history.state;
            const activeModal = document.querySelector('.modal.active');

            // 1. Gestión de visibilidad del Carrito y Checkout
            if (state?.ui === 'cart') {
                if (stickyNav) stickyNav.style.display = 'none';
                cartSidebar?.classList.remove('cart-closed');
                cartItemsView?.classList.remove('hidden');
                checkoutView?.classList.add('hidden');
                lockBodyScroll(true);
            } else if (state?.ui === 'checkout') {
                if (stickyNav) stickyNav.style.display = 'none';
                cartSidebar?.classList.remove('cart-closed');
                cartItemsView?.classList.add('hidden');
                checkoutView?.classList.remove('hidden');
                lockBodyScroll(true);
            } else {
                // Si no hay estado de carrito en el historial, lo cerramos
                cartSidebar?.classList.add('cart-closed');
                if (stickyNav) stickyNav.style.display = 'block';
                if (!activeModal) lockBodyScroll(false);
            }

            // 2. Gestión de Modales (Hamburguesas, Ayuda, etc.)
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

        function actualizarInterfazCarrito() {
            if (!cartBadge || !cartItemsContainer || !cartGrandTotal) return;

            const totalItems = carrito.length;
            cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
            cartBadge.innerText = String(totalItems);
            cartItemsContainer.innerHTML = '';

            let total = 0;
            if (carrito.length === 0) {
                checkoutView?.classList.add('hidden');
                cartItemsView?.classList.remove('hidden');
            }

            guardarCarrito();

            carrito.forEach((item) => {
                total += item.subtotal;
                const div = document.createElement('div');
                div.className = 'cart-item-row';

                const extrasHtml =
                    item.extras?.length > 0
                        ? item.extras
                              .map((e) => {
                                  const cleanName = e.nombre.replace(/^Extra\s+/i, '');
                                  if (e.isToggle && e.val === 'NO') return `SIN ${cleanName}`;
                                  return `+ Extra ${cleanName}${e.qty > 1 ? ` (${e.qty})` : ''}`;
                              })
                              .join(', ')
                        : '';

                div.innerHTML = `
                        <div class="cart-item-info">
                            <h4>${item.cantidad}x ${item.nombre}</h4>
                            <p class="cart-item-extras">${extrasHtml}</p>
                        </div>
                        <div class="cart-item-right">
                            <div class="cart-price-column">
                                <span class="cart-item-price">$${item.subtotal.toFixed(2)}</span>
                                <span class="cart-item-ref">REF</span>
                            </div>
                            <button class="remove-item" data-id="${item.id}" aria-label="Eliminar producto">&times;</button>
                        </div>
                    `;
                cartItemsContainer.appendChild(div);
            });

            cartItemsContainer.querySelectorAll('.remove-item').forEach((btn) => {
                btn.onclick = () => {
                    const idToRemove = btn.getAttribute('data-id');
                    carrito = carrito.filter((item) => item.id !== idToRemove);
                    actualizarInterfazCarrito();
                };
            });

            cartGrandTotal.innerHTML = `$${total.toFixed(2)} <span class="cart-ref-total">REF</span>`;
        }

        cartBtn?.addEventListener('click', () => {
            if (window.history.state?.ui !== 'cart') history.pushState({ ui: 'cart' }, '');
            syncUIWithState();
        });

        closeCart?.addEventListener('click', () => {
            // Si estamos en checkout, cerramos todo el flujo de carrito (2 pasos atrás)
            if (window.history.state?.ui === 'checkout') {
                history.go(-2);
            } else if (window.history.state?.ui === 'cart') {
                history.back();
            } else {
                cartSidebar?.classList.add('cart-closed');
            }
        });

        document.getElementById('btn-ver-bebidas')?.addEventListener('click', () => {
            // 1. Cerrar el carrito con la lógica existente
            if (window.history.state?.ui === 'cart') {
                history.back();
            } else {
                cartSidebar?.classList.add('cart-closed');
                if (stickyNav) stickyNav.style.display = 'block';
                lockBodyScroll(false);
                if (menu) menu.style.overflow = '';
            }

            // 2. Disparar el filtro de bebidas y el scroll con un pequeño delay
            setTimeout(() => {
                const bebidasBtn = document.querySelector('.category-btn[data-category="bebidas"]');
                if (bebidasBtn) bebidasBtn.click();
            }, 350);
        });

        closeModal?.addEventListener('click', cerrarFunc);

        document.querySelectorAll('.menu-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                e.stopImmediatePropagation(); // Bloquea otros scripts (como el inline de index.html) que intenten actuar sobre este clic
                if (stickyNav) stickyNav.style.display = 'none';
                const name = item.querySelector('.item-name')?.textContent.trim() ?? '';
                const desc = item.querySelector('.item-desc')?.textContent.trim() ?? '';
                const priceStr = item.querySelector('.item-price')?.innerText ?? '0';
                basePrice = parsePrice(priceStr);
                esKids = !!item.closest('#kids');
                const nameLower = name.toLowerCase();
                const esNuggets = nameLower.includes('nuggets');
                const esComboHouseLocal = nameLower.includes('combo house');
            esHamburguesa = !!item.closest('#hamburguesas') || esKids || nameLower === 'crispy bowl';

                const esBebida = !!item.closest('#bebidas');
                modal?.querySelector('.modal-content')?.classList.toggle('food-modal', !esBebida);

                const extrasGrid = document.querySelector('.extras-grid');
                if (!extrasGrid) return;

                const allCards = Array.from(extrasGrid.children);
                const descLower = desc.toLowerCase();
                const qtyContainer = modal?.querySelector('.modal-main-qty');
                if (qtyContainer) qtyContainer.style.display = esHamburguesa ? 'none' : 'block';

                if (modalTitle) modalTitle.innerText = name;
                if (modalDesc) modalDesc.innerText = desc;
                if (modalPrice) {
                    modalPrice.innerHTML = `$${basePrice.toFixed(2)} <span class="modal-ref">REF</span>`;
                }

                currentMainQty = 1;
                if (mainQtyVal) mainQtyVal.innerText = String(currentMainQty);

                const mainProteins = ['carne', 'pollo crispy', 'pollo', 'chuleta'];
                const mainProtFound =
                    mainProteins.find((p) => nameLower.includes(p) || descLower.includes(p)) || '';
                const recipeKeywords = [
                    'tocineta',
                    'queso',
                    'pepinillo',
                    'lechuga',
                    'salsa de la casa',
                    'huevito sorpresa'
                ];
                const toggles = allCards.filter((c) => c.dataset.isToggle === 'true');
                const costed = allCards.filter((c) => c.dataset.isToggle !== 'true');

                const sortedToggles = toggles
                    .map((card) => {
                        const cn = card.querySelector('.extra-name')?.textContent.toLowerCase().trim() ?? '';
                        let visible = false;
                        let rank = 1000;
                        const defaultValue = 'SÍ';

                        if (cn.includes('pan') && (esHamburguesa || esKids)) {
                            visible = true;
                            rank = 0;
                        } else if (mainProtFound && cn.includes(mainProtFound)) {
                            visible = true;
                            rank = 1;
                        } else if (
                            recipeKeywords.some((kw) => cn.includes(kw) && descLower.includes(kw))
                        ) {
                            visible = true;
                            const kwFound = recipeKeywords.find(
                                (kw) => cn.includes(kw) && descLower.includes(kw)
                            );
                            rank = 10 + descLower.indexOf(kwFound);
                        }
                        if (esKids && !['pan', 'carne', 'queso', 'huevito sorpresa'].includes(cn)) {
                            visible = false;
                        }
                        if (nameLower.includes('nuggets')) {
                            visible = ['salsa', 'ketchup', 'mostaza', 'mayonesa', 'queso'].some((kw) =>
                                cn.includes(kw)
                            );
                        }
                        const finalVisible =
                            (visible && esHamburguesa && !esComboHouseLocal) ||
                            (visible && nameLower.includes('nuggets'));
                        card.style.display = finalVisible ? 'flex' : 'none';
                        card.dataset.rank = String(rank);
                        const valSpan = card.querySelector('.extra-qty-val');
                        if (valSpan) valSpan.innerText = defaultValue;
                        return card;
                    })
                    .sort((a, b) => parseInt(a.dataset.rank, 10) - parseInt(b.dataset.rank, 10));

                costed.forEach((card) => {
                    const cn = card.querySelector('.extra-name')?.textContent.toLowerCase().trim() ?? '';
                    let v = true;
                    if (esKids) v = cn.includes('huevito');
                    else if (nameLower.includes('nuggets')) {
                        v = ['salsa', 'ketchup', 'mostaza', 'mayonesa', 'queso'].some((kw) =>
                            cn.includes(kw)
                        );
                    } else if (esComboHouseLocal) v = false;
                    card.style.display = v ? 'flex' : 'none';
                    const valSpan = card.querySelector('.extra-qty-val');
                    if (valSpan) valSpan.innerText = '0';
                });

                extrasGrid.innerHTML = '';
                sortedToggles.forEach((c) => extrasGrid.appendChild(c));
                costed.forEach((c) => extrasGrid.appendChild(c));

                // Lógica específica para Crispy Bowl
                if (nameLower === 'crispy bowl') {
                    const allExtras = extrasGrid.querySelectorAll('.extra-card');
                    allExtras.forEach(card => {
                        const isBowlExtra = card.dataset.product === 'crispy bowl';
                        card.style.display = isBowlExtra ? 'flex' : 'none';
                    });
                    extrasContainer.style.display = 'block';
                } else {
                    if (extrasContainer) {
                        // Ocultar extras que pertenecen a productos específicos (como el Bowl) cuando no aplican
                        const allExtras = extrasGrid.querySelectorAll('.extra-card');
                        allExtras.forEach(card => {
                            if (card.dataset.product && card.dataset.product !== nameLower) {
                                card.style.display = 'none';
                            }
                        });

                        extrasContainer.style.display =
                            (esHamburguesa || nameLower.includes('nuggets')) && !esComboHouseLocal
                                ? 'block'
                                : 'none';
                    }
                }

                updateTotal();

                const itemImageSrc = item.querySelector('.item-price-wrapper')?.dataset.imgSrc;
                if (modalImg) {
                    modalImg.src = itemImageSrc || 'hamburguesa.webp';
                    modalImg.classList.remove(
                        'modal-img-bottom-aligned',
                        'modal-img-junior-crispy-lower',
                        'modal-img-alejar'
                    );
                    const needsBottomAlignment =
                        esKids ||
                        name === 'Pork House' ||
                        name === 'Servicio de Papas con Topping' ||
                        esNuggets;
                    const needsNoZoom = name === 'Crispy House' || name === 'House Tower';
                    if (needsNoZoom) modalImg.classList.add('modal-img-alejar');
                    if (needsBottomAlignment) modalImg.classList.add('modal-img-bottom-aligned');
                    else if (name === 'Junior Crispy') {
                        modalImg.classList.add('modal-img-junior-crispy-lower');
                    }
                }

                modal?.classList.add('active');
                history.pushState({ ui: 'modal' }, '');
                lockBodyScroll(true);
                if (menu) menu.style.overflow = 'hidden';
            });
        });

        document.querySelectorAll('#modal-hamburguesa .extra-qty-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.extra-card');
                if (!card) return;
                const valSpan = btn.parentElement?.querySelector('.extra-qty-val');
                if (!valSpan) return;

                const isToggle = card.dataset.isToggle === 'true';
                const text = valSpan.innerText;
                let currentVal = text === 'SÍ' ? 1 : text === 'NO' ? 0 : parseInt(text, 10) || 0;

                if (btn.classList.contains('plus')) {
                    currentVal = isToggle ? 1 : currentVal + 1;
                } else if (btn.classList.contains('minus') && currentVal > 0) {
                    currentVal--;
                }

                valSpan.innerText = isToggle ? (currentVal === 1 ? 'SÍ' : 'NO') : String(currentVal);
                const nameText = card.querySelector('.extra-name')?.innerText ?? '';

                if (nameText === 'Pepinillos' && valSpan.innerText === 'NO') {
                    document
                        .querySelectorAll('.extra-card')
                        .forEach((c) => {
                            if (c.querySelector('.extra-name')?.innerText === 'Extra Pepinillos') {
                                const vs = c.querySelector('.extra-qty-val');
                                if (vs) vs.innerText = '0';
                            }
                        });
                }
                if (nameText === 'Extra Pepinillos' && currentVal > 0) {
                    document.querySelectorAll('.extra-card').forEach((c) => {
                        if (c.querySelector('.extra-name')?.innerText === 'Pepinillos') {
                            const vs = c.querySelector('.extra-qty-val');
                            if (vs) vs.innerText = 'SÍ';
                        }
                    });
                }
                updateTotal();
            });
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

        const agregarAlPedido = () => {
            if (currentMainQty < 1 || !modal) return;

            triggerFlyToCart('modal-img');

            const extrasSeleccionados = [];
            modal.querySelectorAll('.extra-card').forEach((card) => {
                if (card.style.display === 'none') return;
                const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                const nombre = card.querySelector('.extra-name')?.innerText ?? '';
                const isToggle = card.dataset.isToggle === 'true';
                const qty =
                    valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;
                const incluir =
                    (!isToggle && qty > 0) || (isToggle && valText === 'NO');
                if (incluir) {
                    extrasSeleccionados.push({
                        nombre,
                        qty,
                        val: valText,
                        isToggle,
                        precio:
                            (parseFloat(
                                (card.dataset.extraPrice ?? '0').toString().replace(',', '.')
                            ) || 0) * qty
                    });
                }
            });

            const totalExtrasUnitarios = extrasSeleccionados.reduce((acc, e) => acc + e.precio, 0);
            const subtotalCalculado = (basePrice + totalExtrasUnitarios) * currentMainQty;

            carrito.push({
                id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                nombre: modalTitle?.innerText ?? 'Producto',
                cantidad: currentMainQty,
                precioUnitario: basePrice,
                extras: extrasSeleccionados,
                subtotal: Number(subtotalCalculado.toFixed(2))
            });

            actualizarInterfazCarrito();
            currentMainQty = 1;
            if (mainQtyVal) mainQtyVal.innerText = '1';

            modal.querySelectorAll('.extra-card').forEach((card) => {
                const valSpan = card.querySelector('.extra-qty-val');
                if (!valSpan) return;
                if (card.dataset.isToggle === 'true') {
                    const nameLower = card.querySelector('.extra-name')?.innerText.toLowerCase() ?? '';
                    valSpan.innerText = nameLower.includes('extra') ? 'NO' : 'SÍ';
                } else {
                    valSpan.innerText = '0';
                }
            });

            cerrarFunc();

            abrirCarritoConFeedback();
        };

        btnAddOrderMain?.addEventListener('click', agregarAlPedido);

        document.getElementById('btn-go-checkout')?.addEventListener('click', () => {
            if (carrito.length === 0) {
                showToast('Añade algo al carrito primero', 'error');
                return;
            }
            history.pushState({ ui: 'checkout' }, '');
            syncUIWithState();
        });

        document.getElementById('btn-back-to-cart')?.addEventListener('click', () => {
            history.back();
        });

        document.getElementById('form-delivery')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('full-name')?.value.trim() ?? '';
            const notas = document.getElementById('additional-notes')?.value.trim() ?? '';
            const mapsLink = document.getElementById('maps')?.value.trim() ?? '';

            if (!nombre) {
                showToast('Por favor, ingresa tu nombre.', 'error');
                return;
            }

            let mensaje = '🍔 *NUEVO PEDIDO - BURGER HOUSE* 🍔\n\n';
            mensaje += `👤 *Cliente:* ${nombre}\n\n`;
            mensaje += '📝 *DETALLE DEL PEDIDO:*\n';

            let totalPedido = 0;
            carrito.forEach((item) => {
                const extras = item.extras || [];
                const sin = extras
                    .filter((ex) => ex.isToggle && ex.val === 'NO')
                    .map((ex) => ex.nombre.toUpperCase().replace(/^EXTRA\s+/i, ''));
                const con = extras
                    .filter((ex) => !(ex.isToggle && ex.val === 'NO'))
                    .map(
                        (ex) =>
                            `${ex.nombre}${ex.qty > 1 ? ` (${ex.qty})` : ''}`
                    );

                mensaje += `*${item.cantidad}x ${item.nombre}*\n`;
                if (con.length > 0) mensaje += `   + EXTRAS: ${con.join(', ')}\n`;
                if (sin.length > 0) mensaje += `   - QUITAR: ${sin.join(', ')}\n`;
                totalPedido += item.subtotal;
            });

            mensaje += '\n------------------------------\n';
            mensaje += `*TOTAL DEL PEDIDO: $${totalPedido.toFixed(2)} REF*\n`;
            if (currentDeliveryMethod === 'delivery') {
                mensaje += '_(El costo del delivery se calcula al recibir la ubicación)_\n';
            }
            mensaje += '------------------------------\n\n';
            
            mensaje += '*DATOS DE ENTREGA:*\n';
            mensaje += `*Método:* ${currentDeliveryMethod === 'delivery' ? 'DELIVERY 🛵' : 'PICK UP (Retiro en sede) 🏠'}\n`;

            if (currentDeliveryMethod === 'delivery') {
                if (!mapsLink) {
                    showToast('Por favor, obtén tu ubicación haciendo clic en el botón "Enviar dirección" para poder procesar tu delivery.', 'error');
                    return;
                }
                if (notas) mensaje += `*Notas/Referencia:* ${notas}\n`;
                if (mapsLink) mensaje += `*Ubicación Maps:* ${mapsLink}\n`;
            } else {
                if (notas) mensaje += `*Notas adicionales:* ${notas}\n`;
            }

            if (isPreOrder) mensaje += '\n\nPROCESAR AL ABRIR';

            const url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

            // --- REGISTRO DE PEDIDO (FIREBASE + SHEETDB) ---
            const registrarOrden = async () => {
                const fechaActual = new Date().toLocaleString();
                const productosResumen = carrito.map(item => `${item.cantidad}x ${item.nombre}`).join(', ');

                // 1. Guardar en Firebase Realtime Database
                if (typeof firebase !== 'undefined' && firebase.apps.length) {
                    const db = firebase.database();
                    db.ref('pedidos').push({
                        cliente: { nombre, metodo: currentDeliveryMethod, notas_referencia: notas, ubicacion_maps: mapsLink },
                        productos: carrito.map(item => ({
                            nombre: item.nombre,
                            cantidad: item.cantidad,
                            precio_unitario: item.precioUnitario,
                            subtotal: item.subtotal,
                            detalles_personalizacion: item.extras.map(ex => ({ nombre: ex.nombre, cantidad: ex.qty, opcion: ex.val }))
                        })),
                        total_usd: totalPedido,
                        fecha: fechaActual,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        estado: "Pendiente"
                    });
                }

                // 2. Guardar en Google Sheets vía SheetDB
                try {
                    await fetch('https://sheetdb.io/api/v1/qyjuou0mbnjhc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            data: [{
                                fecha: fechaActual,
                                cliente: nombre,
                                metodo: currentDeliveryMethod,
                                productos: productosResumen,
                                total: totalPedido.toFixed(2),
                                notas: notas || "Sin notas adicionales",
                                ubicacion: mapsLink || "N/A"
                            }]
                        })
                    });
                } catch (err) {
                    console.error('Error al guardar en SheetDB:', err);
                }
            };

            // Disparamos los registros de forma asíncrona sin bloquear la apertura de WhatsApp
            registrarOrden();

            try {
                localStorage.removeItem('bh_cart');
            } catch {
                /* ignore */
            }

            pedidoConfirmado = true;
            history.pushState({ orderSent: true }, '');
            window.open(url, '_blank');
            cartSidebar?.classList.add('cart-closed');
            modalReminder?.classList.add('active');
            if (stickyNav) stickyNav.style.display = 'none';
        });

        // Lógica de Upsell (Bebidas) si existe el botón en el HTML
        if (btnUpsellMore) {
            btnUpsellMore.addEventListener('click', () => {
                cerrarFunc();
                setTimeout(() => {
                    const bebidasBtn = document.querySelector('.category-btn[data-category="bebidas"]');
                    if (bebidasBtn) {
                        bebidasBtn.click();
                    }
                }, 500);
            });
        }

        const reloadAfterOrder = () => {
            pedidoConfirmado = false;
            currentMainQty = 1;
            if (mainQtyVal) mainQtyVal.innerText = '1';
            window.location.reload();
        };

        btnReminderOk?.addEventListener('click', reloadAfterOrder);
        btnNewOrder?.addEventListener('click', reloadAfterOrder);

        btnPreOrder?.addEventListener('click', () => {
            modalClosed?.classList.remove('active');
            lockBodyScroll(false);
            if (menu) menu.style.overflow = '';
        });

        function updateTotal() {
            if (!modal || !modalPrice) return;
            let extraTotal = 0;

            modal.querySelectorAll('.extra-card').forEach((card) => {
                if (card.style.display === 'none') return;
                const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                const qty =
                    valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;
                const extraPriceValue =
                    parseFloat((card.dataset.extraPrice ?? '0').toString().replace(',', '.')) || 0;
                extraTotal += qty * extraPriceValue;
            });

            let finalTotal = (basePrice + extraTotal) * (currentMainQty || 1);
            if (Number.isNaN(finalTotal)) finalTotal = basePrice || 0;
            modalPrice.innerHTML = `$${finalTotal.toFixed(2)} <span class="modal-ref">REF</span>`;
            btnAddOrderMain?.classList.remove('btn-highlight');
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal || e.target === modalPromoSelection) {
                cerrarFunc();
            }
        });

        document.getElementById('form-delivery')?.reset();

        window.addEventListener('popstate', (event) => {
            if (pedidoConfirmado) {
                modalReminder?.classList.add('active');
                history.pushState({ orderSent: true }, '');
                return;
            }
            syncUIWithState();
        });

        window.addEventListener('beforeunload', (e) => {
            if (pedidoConfirmado) e.preventDefault();
        });

        /* ——— Geolocalización y taxímetro de delivery ——— */
        const btnLocation = document.getElementById('btn-get-location');
        const inputMaps = document.getElementById('maps');
        const textSpan = btnLocation?.querySelector('span');

        if (btnLocation && inputMaps && textSpan) {
            btnLocation.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    showToast('Lo sentimos, tu navegador no soporta geolocalización.', 'error');
                    return;
                }

                const originalText = textSpan.innerText;
                textSpan.innerText = 'Buscando...';
                btnLocation.classList.add('loading');

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude: lat, longitude: lng } = position.coords;
                        inputMaps.value = `https://maps.google.com/?q=${lat},${lng}`;
                        inputMaps.classList.add('location-success');
                        setTimeout(() => inputMaps.classList.remove('location-success'), 2000);

                        textSpan.innerText = '¡Ubicado!';
                        btnLocation.classList.remove('loading');
                        setTimeout(() => {
                            textSpan.innerText = originalText;
                        }, 2000);
                    },
                    (error) => {
                        textSpan.innerText = originalText;
                        btnLocation.classList.remove('loading');
                        const mensajes = {
                            1: 'Por favor, permite el acceso a tu ubicación para facilitarnos la entrega.',
                            2: 'No pudimos determinar tu ubicación. Verifica tu señal GPS o conexión a internet.',
                            3: 'Se agotó el tiempo de espera al intentar obtener tu ubicación. Por favor, intenta de nuevo.'
                        };
                        showToast(mensajes[error.code] ?? 'No pudimos obtener tu ubicación.', 'error');
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }

    });
})();
