        // State
        let currentQueryType = 'domain';
        let currentData = null;

        // DOM elements
        const queryInput = document.getElementById('queryInput');
        const lookupBtn = document.getElementById('lookupBtn');
        const resultArea = document.getElementById('resultArea');
        const emptyState = document.getElementById('emptyState');
        const errorState = document.getElementById('errorState');
        const resultContent = document.getElementById('resultContent');
        const errorMessage = document.getElementById('errorMessage');
        const copyResultBtn = document.getElementById('copyResultBtn');

        // RDAP endpoints
        const RDAP_ENDPOINTS = {
            domain: 'https://rdap.org/domain/',
            ip: 'https://rdap.org/ip/',
            asn: 'https://rdap.org/autnum/'
        };

        // Detect input type
        function detectType(input) {
            input = input.trim();

            // ASN: "AS12345" or a bare small integer
            if (/^AS[0-9]+$/i.test(input)) {
                return 'asn';
            }
            if (/^[0-9]+$/.test(input) && parseInt(input, 10) < 1000000) {
                return 'asn';
            }

            // IPv4, or IPv6 (full or "::"-compressed)
            const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Pattern = /^[0-9a-fA-F:]*:[0-9a-fA-F:]*$/;
            if (ipv4Pattern.test(input) || (input.includes(':') && ipv6Pattern.test(input))) {
                return 'ip';
            }

            // Default to domain
            return 'domain';
        }

        // Format RDAP data for display
        function formatRDAPData(data, query, type) {
            let html = '';

            // Basic info
            html += `
                <div class="data-section">
                    <h3 class="section-title">Basic Information</h3>
                    <div class="data-grid">
                        <div class="data-item"><div class="data-label">Handle</div><div class="data-value">${escapeHtml(data.handle || 'N/A')}</div></div>
                        <div class="data-item"><div class="data-label">Type</div><div class="data-value">${escapeHtml(data.objectClassName || type)}</div></div>
                        <div class="data-item"><div class="data-label">Query</div><div class="data-value">${escapeHtml(query)}</div></div>
                    </div>
                </div>
            `;

            // Events (dates)
            if (data.events && data.events.length) {
                html += `
                    <div class="data-section">
                        <h3 class="section-title">Important Dates</h3>
                        <div class="data-grid">
                `;
                data.events.forEach(event => {
                    const eventName = event.eventAction || 'event';
                    html += `
                        <div class="data-item">
                            <div class="data-label">${escapeHtml(eventName.replace('_', ' '))}</div>
                            <div class="data-value">${escapeHtml(event.eventDate || 'N/A')}</div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            // Entities (contacts)
            if (data.entities && data.entities.length) {
                html += `
                    <div class="data-section">
                        <h3 class="section-title">Contacts & Entities</h3>
                        <div class="data-grid">
                `;
                data.entities.forEach(entity => {
                    const roles = entity.roles ? entity.roles.join(', ') : 'unknown';
                    const name = entity.vcardArray ?
                        entity.vcardArray[1]?.find(v => v[0] === 'fn')?.[3] :
                        entity.handle || 'N/A';
                    html += `
                        <div class="data-item">
                            <div class="data-label">${escapeHtml(roles)}</div>
                            <div class="data-value">${escapeHtml(name)}</div>
                            ${entity.handle ? `<div class="data-value sub">Handle: ${escapeHtml(entity.handle)}</div>` : ''}
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            // Nameservers (for domains)
            if (data.nameservers && data.nameservers.length) {
                html += `
                    <div class="data-section">
                        <h3 class="section-title">Nameservers</h3>
                        <div class="data-grid">
                `;
                data.nameservers.forEach(ns => {
                    html += `
                        <div class="data-item"><div class="data-value">${escapeHtml(ns.ldhName || ns.handle)}</div></div>
                    `;
                });
                html += `</div></div>`;
            }

            // Status
            if (data.status && data.status.length) {
                html += `
                    <div class="data-section">
                        <h3 class="section-title">Status</h3>
                        <div class="data-grid">
                `;
                data.status.forEach(status => {
                    html += `<div class="data-item"><div class="data-value">${escapeHtml(status)}</div></div>`;
                });
                html += `</div></div>`;
            }

            // Public IDs
            if (data.publicIds && data.publicIds.length) {
                html += `
                    <div class="data-section">
                        <h3 class="section-title">Registry Identifiers</h3>
                        <div class="data-grid">
                `;
                data.publicIds.forEach(id => {
                    html += `
                        <div class="data-item">
                            <div class="data-label">${escapeHtml(id.type || 'Identifier')}</div>
                            <div class="data-value">${escapeHtml(id.identifier || 'N/A')}</div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            // Full JSON (collapsible)
            html += `
                <div class="data-section">
                    <h3 class="section-title">Full RDAP Response (JSON)</h3>
                    <div class="json-viewer">${escapeHtml(JSON.stringify(data, null, 2))}</div>
                </div>
            `;

            return html;
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        // Perform RDAP lookup
        async function performLookup() {
            let query = queryInput.value.trim();
            if (!query) {
                showError('Please enter a domain, IP address, or ASN');
                return;
            }

            // Auto-detect type
            const detectedType = detectType(query);
            currentQueryType = detectedType;

            // Update active button visually
            document.querySelectorAll('.type-btn').forEach(btn => {
                const active = btn.getAttribute('data-type') === detectedType;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            // Format ASN properly
            let lookupQuery = query;
            if (detectedType === 'asn') {
                if (!query.toUpperCase().startsWith('AS')) {
                    lookupQuery = `AS${query}`;
                } else {
                    lookupQuery = query.toUpperCase();
                }
            }

            const endpoint = RDAP_ENDPOINTS[detectedType];
            const url = endpoint + encodeURIComponent(lookupQuery);

            // Show loading
            lookupBtn.disabled = true;
            lookupBtn.innerHTML = '<span class="loader"></span> Looking up...';
            resultArea.style.display = 'none';
            emptyState.style.display = 'none';
            errorState.style.display = 'none';

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                currentData = data;

                resultContent.innerHTML = formatRDAPData(data, query, detectedType);
                resultArea.style.display = 'block';

            } catch (err) {
                console.error('RDAP lookup error:', err);
                showError(`Failed to lookup "${escapeHtml(query)}": ${escapeHtml(err.message)}<br><br>Note: Not all domains/IPs have RDAP records available.`);
            } finally {
                lookupBtn.disabled = false;
                lookupBtn.textContent = 'Lookup';
            }
        }

        function showError(message) {
            errorMessage.innerHTML = message;
            errorState.style.display = 'block';
            resultArea.style.display = 'none';
            emptyState.style.display = 'none';
        }

        // Copy JSON
        copyResultBtn.addEventListener('click', () => {
            if (currentData) {
                navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
                const originalText = copyResultBtn.textContent;
                copyResultBtn.textContent = 'Copied';
                setTimeout(() => {
                    copyResultBtn.textContent = originalText;
                }, 2000);
            }
        });

        // Tab switching (ARIA tabs pattern: roving tabindex + arrow-key navigation)
        const tabButtons = ['tabAbout', 'tabCompare', 'tabFields'].map(id => document.getElementById(id));
        const tabPanels = ['aboutTab', 'compareTab', 'fieldsTab'].map(id => document.getElementById(id));

        function switchTab(index) {
            tabButtons.forEach((btn, i) => {
                const active = i === index;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
                btn.tabIndex = active ? 0 : -1;
                tabPanels[i].classList.toggle('active', active);
            });
        }

        tabButtons.forEach((btn, i) => {
            btn.addEventListener('click', () => switchTab(i));
            btn.addEventListener('keydown', (e) => {
                let target = null;
                if (e.key === 'ArrowRight') target = (i + 1) % tabButtons.length;
                else if (e.key === 'ArrowLeft') target = (i - 1 + tabButtons.length) % tabButtons.length;
                else if (e.key === 'Home') target = 0;
                else if (e.key === 'End') target = tabButtons.length - 1;
                else return;
                e.preventDefault();
                tabButtons[target].focus();
                switchTab(target);
            });
        });

        // Type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                currentQueryType = type;
                document.querySelectorAll('.type-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                queryInput.placeholder = type === 'domain' ? 'example.com' : (type === 'ip' ? '8.8.8.8' : 'AS15169');
            });
        });

        // Example links
        document.querySelectorAll('.example-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const value = link.getAttribute('data-value');
                queryInput.value = value;
                performLookup();
            });
        });

        // Enter key
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performLookup();
        });

        lookupBtn.addEventListener('click', performLookup);

        // Only auto-lookup when a query is passed explicitly via URL
        function handleUrlParameter() {
            const urlParams = new URLSearchParams(window.location.search);
            const queryParam = urlParams.get('query');
            if (queryParam) {
                queryInput.value = queryParam;
                performLookup();
            }
        }

        window.addEventListener('load', handleUrlParameter);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
        }
