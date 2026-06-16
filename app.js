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
        WEEKDAY_OPEN: 1020,
        WEEKDAY_CLOSE: 1350,
        WEEKEND_OPEN: 780,
        PROMO_BASE_PRICE: 6.5,
        PROMO_COMBO_PRICE: 8.5,
        PROMO_COMBO_EXTRA: 2.0
    };

    // --- BASE DE DATOS DINÁMICA DE EXTRAS ---
    const EXTRAS_DB = [
        // EXTRAS CON COSTO (Hamburguesas)
        { name: 'Extra Pollo', price: 2.50, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Carne', price: 2.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Pollo Crispy', price: 3.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Chuleta', price: 3.50, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Huevo (proteína)', price: 1.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Cheese', price: 1.20, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Tocineta', price: 2.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Salsa de la Casa', price: 1.20, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Lechuga', price: 1.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        { name: 'Extra Pepinillos', price: 1.00, type: 'cost', applies: c => c.esHamburguesa && !c.esCombo },
        
        // EXTRAS CON COSTO (Menú Kids)
        { name: 'Extra Huevito Sorpresa', price: 1.00, type: 'cost', applies: c => (c.esHamburguesa && !c.esCombo) || c.esKids },

        // SERVICIOS EXTRAS (Nuggets / Papas) - Salsas sin costo, toggles SÍ/NO
        { name: 'Servicio de salsa BBQ', type: 'toggle', applies: c => c.isNuggets, default: () => 'NO' }, // Por defecto NO
        { name: 'Servicio de Ketchup', type: 'toggle', applies: c => c.isNuggets, default: () => 'NO' }, // Por defecto NO
        { name: 'Servicio de Salsa de la Casa', type: 'toggle', applies: c => c.isNuggets, default: () => 'SÍ' }, // Por defecto SÍ

        // INGREDIENTES BASE (Interruptores SÍ/NO) -> APLICAN ESTRICTAMENTE LEYENDO LA DESCRIPCIÓN
        { name: 'Pan', type: 'toggle', applies: c => c.descLower.includes('pan') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Carne', type: 'toggle', applies: c => c.descLower.includes('carne') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Pollo Crispy', type: 'toggle', applies: c => (c.descLower.includes('pollo crispy') || c.descLower.includes('pechuga crispy')) && !c.isNuggets && !c.esCombo, default: () => 'SÍ' },
        { name: 'Pollo a la plancha', type: 'toggle', applies: c => c.descLower.includes('pollo') && !c.descLower.includes('pollo crispy') && !c.descLower.includes('pechuga crispy') && !c.isNuggets && !c.esCombo, default: () => 'SÍ' },
        { name: 'Chuleta', type: 'toggle', applies: c => c.descLower.includes('chuleta') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Tocineta', type: 'toggle', applies: c => c.descLower.includes('tocineta') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Queso', type: 'toggle', applies: c => c.descLower.includes('queso') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Pepinillos', type: 'toggle', applies: c => c.descLower.includes('pepinillo') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Lechuga', type: 'toggle', applies: c => c.descLower.includes('lechuga') && !c.esCombo, default: () => 'SÍ' },
        { name: 'Salsa de la Casa', type: 'toggle', applies: c => c.descLower.includes('salsa de la casa') && !c.esCombo, default: () => 'SÍ' },
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

    const showDiscountModal = (visitorNumber) => {
        const modal = document.getElementById('modal-discount');
        if (!modal) return;

        // Solo mostrar modal para los primeros 5 clientes
        if (visitorNumber > 5) return;

        // Actualizar el mensaje según el número de cliente
        const visitorNumberElement = modal.querySelector('.visitor-number');
        const discountPercentageElement = modal.querySelector('.discount-percentage');

        if (!visitorNumberElement || !discountPercentageElement) {
            console.error('Error: Elementos del modal no encontrados');
            return;
        }

        visitorNumberElement.textContent = visitorNumber;

        if (visitorNumber === '1' || visitorNumber === 1) {
            discountPercentageElement.textContent = '40% de descuento';
        } else {
            discountPercentageElement.textContent = '20% de descuento';
        }

        modal.classList.add('active');
        lockBodyScroll(true);

        // Esta es la función que el usuario llama "claimDiscount"
        const claimDiscount = (e) => {
            const btn = e?.currentTarget;
            
            // Obtener el UID de forma segura para evitar errores de variable no definida
            const user = firebase?.auth?.().currentUser;
            if (!user) {
                console.error("Error crítico: No se pudo obtener el usuario para reclamar el descuento.");
                showToast('Error al reclamar. Intenta de nuevo.', 'error');
                return;
            }
            const userUID = user.uid;

            // Guardar la marca en la base de datos para evitar trampas
            try {
                const db = firebase.database();
                db.ref('usuarios_descuento/' + userUID).set(true);
                localStorage.setItem('bh_discount_claimed_db', 'true');
                console.log(`✅ Descuento reclamado y marcado en DB para UID: ${userUID}`);
            } catch (error) {
                console.error("Error al guardar la marca del descuento en Firebase:", error);
            }

            // Lógica para cerrar el modal con animación
            const closeAndContinue = () => {
                modal.classList.remove('active');
                lockBodyScroll(false);
                setTimeout(verificarYMostrarPromo, 300);
            };

            if (btn && btn.id === 'btn-close-discount') {
                const spinner = btn.querySelector('.btn-spinner');
                const textSpan = btn.querySelector('.btn-text');
                btn.style.pointerEvents = 'none';
                if (spinner) spinner.classList.add('active');
                if (textSpan) textSpan.innerText = 'Cargando...';
                
                setTimeout(() => {
                    closeAndContinue();
                    btn.style.pointerEvents = 'auto';
                    if (spinner) spinner.classList.remove('active');
                    if (textSpan) textSpan.innerText = '¡GENIAL!';
                }, 350);
            } else {
                closeAndContinue();
            }
        };

        document.getElementById('close-discount-modal')?.addEventListener('click', claimDiscount);
        document.getElementById('btn-close-discount')?.addEventListener('click', claimDiscount);
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
    
            // --- 2. LÓGICA DEL LANZAMIENTO (REFORZADA CON AUTH ANÓNIMA) ---
            const launchDate = window.launchDate || 0;
            const now = new Date().getTime();
            const isAfterLaunch = now >= launchDate;
    
            // VERIFICACIÓN ANTI-TRAMPA 1: Si la DB ya nos dijo que este usuario reclamó, no hacer nada.
            if (localStorage.getItem('bh_discount_claimed_db') === 'true') {
                console.log('🚫 Descuento ya reclamado (verificado desde DB). Se omite la lógica de lanzamiento.');
                return;
            }

            // El localStorage es solo una optimización para no consultar la DB innecesariamente.
            // La verdadera seguridad está en la transacción que valida el userUID.
            if (isAfterLaunch && !localStorage.getItem('bh_first20_registered')) { // VERIFICACIÓN ANTI-TRAMPA 2 (local)
    
                const firstWinnersRef = db.ref('stats/first5_after_launch');
    
                firstWinnersRef.transaction((currentData) => {
                    if (currentData === null) {
                        currentData = {}; // Inicializa la estructura si no existe
                    }
                    // Si el UID del usuario ya existe, aborta la transacción. ¡Anti-trampa!
                    if (currentData[userUID]) {
                        return; 
                    }
                    const winnerCount = Object.keys(currentData).length;
                    if (winnerCount < 5) {
                        currentData[userUID] = winnerCount + 1; // Asigna el número al UID del ganador
                        return currentData;
                    }
                    return; // Aborta si los 5 cupos ya están llenos
                }, (error, committed, snapshot) => {
                    if (error) {
                        console.error("Transaction failed, activando función de repuesto local: ", error);
                        
                        // FALLBACK LOCAL: Si el servidor falla por completo, asumimos localmente que llegó 'tarde'
                        // para que la interfaz no se congele, el overlay desaparezca y el usuario pueda navegar,
                        // armar su pedido y enviar su comanda por WhatsApp normalmente sin descuentos falsos.
                        localStorage.setItem('bh_first20_registered', 'true');
                        localStorage.setItem('bh_first20_number', 'tarde'); 
                        
                        if (typeof showToast === 'function') {
                            showToast('Conexión saturada. Puedes proceder con tu pedido normalmente.', 'info');
                        }
                        return;
                    }
    
                    if (committed && snapshot.exists()) {
                        const winnerData = snapshot.val();
                        const visitorNumber = winnerData[userUID];

                        localStorage.setItem('bh_first20_registered', 'true');
                        localStorage.setItem('bh_first20_number', visitorNumber.toString());
                        setTimeout(() => showDiscountModal(visitorNumber), 500);
                    } else {
                        // Transacción abortada (llegó tarde o ya había participado).
                        localStorage.setItem('bh_first20_registered', 'true');
                        localStorage.setItem('bh_first20_number', 'tarde');

                        // Recuperación: Si el usuario borró localStorage pero ya había ganado, se lo recordamos.
                        db.ref('stats/first5_after_launch/' + userUID).once('value').then(snap => {
                            if (snap.exists()) {
                                const existingNumber = snap.val();
                                localStorage.setItem('bh_first20_number', existingNumber.toString());
                                setTimeout(() => showDiscountModal(existingNumber), 500);
                            }
                        });
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

                const isFirst20 = localStorage.getItem('bh_first20_registered') === 'true';
                const visitorNumber = localStorage.getItem('bh_first20_number');
                const isTop5 = visitorNumber && parseInt(visitorNumber) <= 5;

                // Mostrar modal de promos después de 3s para todos los usuarios
                setTimeout(verificarYMostrarPromo, 3000);
            }, 200);
        };

        const imgs = Array.from(document.querySelectorAll('img'));
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
        // verificarHorario(); // Desactivado temporalmente para el lanzamiento

        /* ——— Búsqueda y categorías ——— */
        const searchInput = document.getElementById('menu-search');
        searchInput?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const isSearching = term.length > 0;
            const videoFeed = document.getElementById('bh-video-feed-scroll');
            const startOrderText = document.querySelector('.start-order-text');
            const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';

            if (isSearching) {
                videoFeed?.classList.add('hidden');
                startOrderText?.classList.add('hidden');
            } else {
                videoFeed?.classList.toggle('hidden', activeCategory !== 'all');
                startOrderText?.classList.toggle('hidden', activeCategory !== 'all');
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

        document.getElementById('btn-promo-ordenar')?.addEventListener('click', () => {
            document.getElementById('modal-promo-lunes-miercoles')?.classList.remove('active');
            document.getElementById('modal-promo-selection')?.classList.add('active');
            lockBodyScroll(true);
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
        document.getElementById('promo-combo-option')?.addEventListener('click', function() {
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
                    nombre: 'Papitas',
                    qty: 1,
                    val: '1',
                    isToggle: false,
                    precio: 0
                });
                extras.push({
                    nombre: 'Bombita',
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
        if (carrito.length > 0) actualizarInterfazCarrito();

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
            if(cartBadge) {
                cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
                cartBadge.innerText = String(totalItems);
            }
            if(cartItemsContainer) cartItemsContainer.innerHTML = '';

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
                        const cleanName = ex.nombre.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                        extrasHtmlParts.push(`<span style="color:#28a745">• Extra ${cleanName}${ex.qty > 1 ? ` (${ex.qty})` : ''}</span>`);
                    });

                    sinExtras.forEach(ex => {
                        const displayName = ex.nombre.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                        extrasHtmlParts.push(`<span style="color:#ff4d4d">• Sin ${displayName}</span>`);
                    });
                }
                const extrasHtml = extrasHtmlParts.join('<br>');

                if(cartItemsContainer){
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
                    actualizarInterfazCarrito();
                };
            });
            if(cartGrandTotal) cartGrandTotal.innerHTML = `$${total.toFixed(2)} <span class="cart-ref-total">REF</span>`;
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
            modal.querySelectorAll('.extra-card').forEach((card) => {
                const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                const qty = valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;
                const extraPriceValue = parseFloat(card.dataset.extraPrice || '0');
                extraTotal += qty * extraPriceValue;
            });
            const finalTotal = ((basePrice + extraTotal) * currentMainQty) || basePrice || 0;
            modalPrice.innerHTML = `$${finalTotal.toFixed(2)} <span class="modal-ref">REF</span>`;
            btnAddOrderMain?.classList.remove('btn-highlight');
        }

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
                esComboHouse = nameLower.includes('combo house');
                const esBebida = !!item.closest('#bebidas');
                
                modal?.querySelector('.modal-content')?.classList.toggle('food-modal', !esBebida);
                if (modalTitle) modalTitle.innerText = name;
                if (modalDesc) modalDesc.innerText = desc;
                if (modalPrice) modalPrice.innerHTML = `$${basePrice.toFixed(2)} <span class="modal-ref">REF</span>`;

                currentMainQty = 1;
                if (mainQtyVal) mainQtyVal.innerText = String(currentMainQty);
                const qtyContainer = modal?.querySelector('.modal-main-qty');
                if (qtyContainer) qtyContainer.style.display = esBebida ? 'block' : 'none';

                // Generación Dinámica de Extras ESTRICTA basada en texto de descripción
                if (extrasGrid) {
                    const ctx = {
                        nameLower, descLower, esHamburguesa, esKids, esCombo: esComboHouse,
                        isNuggets: nameLower.includes('nuggets'),
                        isCrispyBowl: nameLower === 'crispy bowl',
                        isPolloCrispy: descLower.includes('pollo crispy'),
                        isPolloNormal: descLower.includes('pollo') && !descLower.includes('pollo crispy'),
                        hasChuleta: descLower.includes('chuleta')
                    };

                    const applicableExtras = EXTRAS_DB.filter(ex => ex.applies(ctx)); // Filtra todos los extras que aplican
                    const toggleExtras = applicableExtras.filter(ex => ex.type === 'toggle'); // Separa los toggles
                    const costExtras = applicableExtras.filter(ex => ex.type === 'cost'); // Separa los extras con costo
                    const orderedExtras = [...toggleExtras, ...costExtras]; // Une, poniendo los toggles primero
                    
                    extrasGrid.innerHTML = orderedExtras.map(ex => {
                        const isToggle = ex.type === 'toggle';
                        const defaultVal = isToggle ? ex.default(ctx) : '0';
                        const isSelected = isToggle && defaultVal === 'SÍ';

                        return `
                        <div class="extra-card ${isSelected ? 'selected' : ''}" data-extra-price="${isToggle ? 0 : ex.price}" data-is-toggle="${isToggle}">
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
                    }).join(''); // Renderiza los extras en el nuevo orden

                    if (extrasContainer) extrasContainer.style.display = orderedExtras.length > 0 ? 'block' : 'none';
                }

                updateTotal();

                const itemImageSrc = item.querySelector('.item-price-wrapper')?.dataset.imgSrc;
                if (modalImg) {
                    modalImg.src = itemImageSrc || 'hamburguesa.webp';
                    modalImg.className = '';
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
            modal.querySelectorAll('.extra-card').forEach((card) => {
                const valText = card.querySelector('.extra-qty-val')?.innerText ?? '';
                const nombre = card.querySelector('.extra-name')?.innerText ?? '';
                const isToggle = card.dataset.isToggle === 'true';
                const qty = valText === 'SÍ' ? 1 : valText === 'NO' ? 0 : parseInt(valText, 10) || 0;
                
                // REGLA ESTRICTA: Solo capturar si se modifica el defecto
                // Para toggles: capturar si es diferente del valor por defecto (SÍ para ingredientes base, NO para salsas)
                // Para extras con costo: capturar si qty > 0
                let isModified = false;
                if (isToggle) {
                    // Salsas de nuggets tienen default NO, ingredientes base tienen default SÍ
                    const isNuggetsSalsa = nombre.includes('Servicio de');
                    const defaultVal = isNuggetsSalsa ? 'NO' : 'SÍ';
                    isModified = valText !== defaultVal;
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

            // LÓGICA ESPECIAL: Añadir Pepsi por defecto al Combo House
            if (esComboHouse) {
                extrasSeleccionados.push({
                    nombre: '(+ Pepsi 1L)',
                    qty: 1,
                    val: 'SÍ',
                    isToggle: true,
                    precio: 0
                });
            }

            const subtotal = (basePrice + extrasSeleccionados.reduce((acc, e) => acc + e.precio, 0)) * currentMainQty;

            carrito.push({
                id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                nombre: modalTitle?.innerText ?? 'Producto',
                cantidad: currentMainQty,
                precioUnitario: basePrice,
                extras: extrasSeleccionados,
                subtotal: Number(subtotal.toFixed(2))
            });

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
            btnLocation.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    return showToast('Tu dispositivo no soporta geolocalización.', 'error');
                }
                
                const spinner = btnLocation.querySelector('.btn-spinner');
                const textSpan = btnLocation.querySelector('.btn-text') || btnLocation.querySelector('span');
                const svgIcon = btnLocation.querySelector('.location-icon');
                
                const originalText = textSpan.innerText;
                textSpan.innerText = 'Buscando...';
                btnLocation.classList.add('loading');
                btnLocation.disabled = true;
                if (spinner) spinner.classList.add('active');
                if (svgIcon) svgIcon.style.display = 'none';

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        inputMaps.value = `https://maps.google.com/?q=${lat},${lng}`;
                        
                        inputMaps.classList.add('location-success');
                        setTimeout(() => inputMaps.classList.remove('location-success'), 2000);
                        
                        textSpan.innerText = '¡Ubicación guardada!';
                        btnLocation.classList.remove('loading');
                        btnLocation.disabled = false;
                        if (spinner) spinner.classList.remove('active');
                        if (svgIcon) svgIcon.style.display = 'block';
                        showToast('Ubicación capturada correctamente', 'success');
                    },
                    (error) => {
                        textSpan.innerText = originalText;
                        btnLocation.classList.remove('loading');
                        btnLocation.disabled = false;
                        if (spinner) spinner.classList.remove('active');
                        if (svgIcon) svgIcon.style.display = 'block';
                        
                        let errorMsg = 'Error al obtener ubicación. Permite el acceso GPS.';
                        if (error.code === 1) {
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                            if (isIOS) {
                                errorMsg = 'iPhone: Ve a Ajustes > Safari > Ubicación > Permitir. O pega tu enlace de Maps manualmente.';
                            } else {
                                errorMsg = 'Permiso de ubicación denegado. Permite el acceso GPS o pega tu enlace de Maps manualmente.';
                            }
                        }
                        if (error.code === 2) errorMsg = 'Información de ubicación no disponible (señal débil). Pega tu enlace de Maps manualmente.';
                        if (error.code === 3) errorMsg = 'Tiempo de espera agotado. Pega tu enlace de Maps manualmente.';
                        
                        showToast(errorMsg, 'error');
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
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
                const visitorNumber = localStorage.getItem('bh_first20_number');
                if (visitorNumber && visitorNumber !== 'tarde') mensaje += `*Cliente #:* ${visitorNumber}\n`;
                
                mensaje += '\n*DETALLE DEL PEDIDO:*\n';
                carrito.forEach((item) => {
                    const isNuggetsItem = item.nombre.toLowerCase().includes('nuggets');

                    // Filtrar lo que se quitó (Toggles en NO)
                    const sin = item.extras?.filter(ex => ex.isToggle && ex.val === 'NO').map(ex => ex.nombre.toUpperCase().replace(/^EXTRA\s+/i, ''));
                    
                    // Todos los extras que se agregaron o activaron
                    const extrasAgregados = item.extras?.filter(ex => {
                        // Para no-toggle: mostrar si qty > 0
                        if (!ex.isToggle) return ex.qty > 0;
                        // Para toggle: mostrar si val es SÍ (independientemente del default)
                        return ex.val === 'SÍ';
                    }).map(ex => {
                        const cleanName = ex.nombre.replace(/^Extra\s+/i, '').replace('Servicio de ', '');
                        return `${cleanName}${ex.qty > 1 ? ` (${ex.qty})` : ''}`;
                    });
                    
                    mensaje += `*${item.cantidad}x ${item.nombre}*\n`;
                    if (extrasAgregados?.length > 0) mensaje += `   EXTRAS:\n     - ${extrasAgregados.join('\n     - ')}\n`;
                    if (sin?.length > 0) mensaje += `   SIN:\n     - ${sin.join('\n     - ')}\n`;
                });

                mensaje += '\n------------------------------\n';
                let totalConDescuento = totalPedido;

                if (localStorage.getItem('bh_first20_registered') === 'true' && visitorNumber && visitorNumber !== 'tarde') {
                    const visitorNum = parseInt(visitorNumber);
                    let descPrc = 0;

                    if (visitorNum === 1) {
                        descPrc = 0.40; // 40% para el primero
                    } else if (visitorNum >= 2 && visitorNum <= 5) {
                        descPrc = 0.20; // 20% para los siguientes 4
                    }

                    if (descPrc > 0) {
                        const montoDescontado = totalPedido * descPrc;
                        totalConDescuento = totalPedido - montoDescontado;
                        
                        mensaje += `*SUBTOTAL:* $${totalPedido.toFixed(2)} REF\n`;
                        mensaje += `*¡PREMIO CLIENTE #${visitorNum}! (${descPrc * 100}% OFF)*\n`;
                        mensaje += `*DESCUENTO:* -$${montoDescontado.toFixed(2)} REF\n`;
                        mensaje += `------------------------------\n`;
                        mensaje += `*TOTAL A PAGAR: $${totalConDescuento.toFixed(2)} REF*\n`;
                        mensaje += `_(Te ahorraste: $${montoDescontado.toFixed(2)} REF)_\n`;
                    } else {
                        mensaje += `*TOTAL DEL PEDIDO: $${totalPedido.toFixed(2)} REF*\n`;
                    }
                } else {
                    mensaje += `*TOTAL DEL PEDIDO: $${totalPedido.toFixed(2)} REF*\n`;
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
                    const fechaActual = new Date().toLocaleString();
                    const productosResumen = carrito.map(item => `${item.cantidad}x ${item.nombre}`).join(', ');

                    // Firebase
                    if (typeof firebase !== 'undefined' && firebase.apps.length) {
                        try {
                            const db = firebase.database();
                            await db.ref('pedidos').push({
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
                            });
                        } catch (err) { console.error("Fallo menor: Firebase no respondió a tiempo", err); }
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
                try { localStorage.removeItem('bh_cart'); } catch (e) {}

                pedidoConfirmado = true;
                history.pushState({ orderSent: true }, '');
                window.open(url, '_blank');
                
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

        window.addEventListener('beforeunload', (e) => { if (pedidoConfirmado) e.preventDefault(); });
    });
})();