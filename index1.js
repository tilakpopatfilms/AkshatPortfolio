
        // Scroll reveal
        const revealElements = document.querySelectorAll('.section-reveal');
        const revealOnScroll = () => {
            revealElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight - 100) el.classList.add('revealed');
            });
        };
        window.addEventListener('scroll', revealOnScroll);
        window.addEventListener('load', revealOnScroll);

        // Mobile menu
        const hamburger = document.getElementById('hamburgerBtn');
        const overlay = document.getElementById('mobileOverlay');
        const menuContainer = document.getElementById('mobileMenuContainer');
        const mobileCloseBtn = document.getElementById('mobileCloseBtn');
        
        function openMenu() {
            hamburger.classList.add('active');
            overlay.classList.add('active');
            menuContainer.classList.add('active');
            document.body.classList.add('menu-open');
        }
        
        function closeMenu() {
            hamburger.classList.remove('active');
            overlay.classList.remove('active');
            menuContainer.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
        
        hamburger.addEventListener('click', openMenu);
        mobileCloseBtn.addEventListener('click', closeMenu);
        overlay.addEventListener('click', closeMenu);
        
        document.querySelectorAll('#mobileMenuContainer a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menuContainer.classList.contains('active')) closeMenu();
        });


        // GMAWE – PERFECT ATTACHMENT, MATCHING COLORS, NO EXTRA HORIZONTAL
        (function() {
            const linePath = document.getElementById('animatedLine');
            const arrowGroup = document.getElementById('movingArrowGroup');
            const arrowHead = document.getElementById('arrowHead');
            
            if (!linePath || !arrowGroup || !arrowHead) return;
            
            function getLastSegmentPoints(d) {
                const matches = d.match(/(\d+)[\s,]+(\d+)/g);
                if (!matches) return null;
                const points = matches.map(m => {
                    const [x, y] = m.split(/[\s,]+/).map(Number);
                    return { x, y };
                });
                if (points.length < 2) return null;
                const tip = points[points.length - 1];
                const prev = points[points.length - 2];
                return { tip, prev };
            }
            
            function buildArrowPath(tip, prev, armLength = 24, halfAngle = 0.55) {
                const dx = tip.x - prev.x;
                const dy = tip.y - prev.y;
                const len = Math.hypot(dx, dy);
                if (len === 0) return '';
                const ux = dx / len;
                const uy = dy / len;
                const bx = -ux;
                const by = -uy;
                const px = -by;
                const py = bx;
                const cosA = Math.cos(halfAngle);
                const sinA = Math.sin(halfAngle);
                const ax1 = bx * cosA - px * sinA;
                const ay1 = by * cosA - py * sinA;
                const ax2 = bx * cosA + px * sinA;
                const ay2 = by * cosA + py * sinA;
                const p1x = tip.x + ax1 * armLength;
                const p1y = tip.y + ay1 * armLength;
                const p2x = tip.x + ax2 * armLength;
                const p2y = tip.y + ay2 * armLength;
                return `M ${tip.x},${tip.y} L ${p1x},${p1y} M ${tip.x},${tip.y} L ${p2x},${p2y}`;
            }
            
            const dAttr = linePath.getAttribute('d');
            const seg = getLastSegmentPoints(dAttr);
            if (!seg) return;
            
            const tipX = seg.tip.x;
            const tipY = seg.tip.y;
            const arrowPathString = buildArrowPath(seg.tip, seg.prev, 24, 0.55);
            arrowHead.setAttribute('d', arrowPathString);
            
            const totalLength = linePath.getTotalLength();
            linePath.style.strokeDasharray = totalLength;
            
            const duration = 4000;
            let startTime = null;
            let animationId = null;
            
            function ease(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
            
            function animate(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                let progress = Math.min(1, elapsed / duration);
                const eased = ease(progress);
                
                const offset = totalLength * (1 - eased);
                linePath.style.strokeDashoffset = offset;
                
                const point = linePath.getPointAtLength(totalLength * eased);
                const dx = point.x - tipX;
                const dy = point.y - tipY;
                arrowGroup.setAttribute('transform', `translate(${dx}, ${dy})`);
                
                const scaleVal = 0.15 + (eased * 0.85);
                arrowHead.setAttribute('transform', `scale(${scaleVal})`);
                arrowHead.style.transformOrigin = `${tipX}px ${tipY}px`;
                
                if (progress < 1) {
                    animationId = requestAnimationFrame(animate);
                } else {
                    setTimeout(() => {
                        startTime = null;
                        animationId = requestAnimationFrame(animate);
                    }, 600);
                }
            }
            
            animationId = requestAnimationFrame(animate);
        })();
  

        // Contact form
        const form = document.getElementById('contactForm');
        const formMsg = document.getElementById('formMessage');
        const submitBtn = document.getElementById('submitBtn');
        
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const subject = document.getElementById('subject').value;
                const message = document.getElementById('message').value;
                
                if (!name || !email || !subject || !message) {
                    formMsg.innerHTML = '<span class="text-red-400">Please fill in all fields.</span>';
                    setTimeout(() => formMsg.innerHTML = '', 3000);
                    return;
                }
                
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending...</span>';
                submitBtn.classList.add('opacity-50');
                formMsg.innerHTML = '<span class="text-brand-accent2">Sending your message...</span>';
                
                const fd = new FormData();
                fd.append('access_key', '533237a1-aba8-4707-aaf3-37ecf860a73c');
                fd.append('name', name);
                fd.append('email', email);
                fd.append('subject', subject);
                fd.append('message', message);
                
                try {
                    const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) {
                        formMsg.innerHTML = '<span class="text-green-400">Message sent successfully! I will get back to you soon.</span>';
                        form.reset();
                        setTimeout(() => formMsg.innerHTML = '', 5000);
                    } else {
                        formMsg.innerHTML = '<span class="text-red-400">Something went wrong. Please try again.</span>';
                        setTimeout(() => formMsg.innerHTML = '', 4000);
                    }
                } catch {
                    formMsg.innerHTML = '<span class="text-red-400">Network error. Please check your connection.</span>';
                    setTimeout(() => formMsg.innerHTML = '', 4000);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Send Message</span>';
                    submitBtn.classList.remove('opacity-50');
                }
            });
        }
