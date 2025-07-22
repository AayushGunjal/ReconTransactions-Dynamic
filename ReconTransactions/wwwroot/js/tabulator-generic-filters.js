// SVG ICONS
const svgFilter = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align:middle" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6h16l-6 9v4l-4 1v-5l-6-9z" fill="none" stroke="#888" stroke-width="2"/>
</svg>`;

const svgFilterFilled = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align:middle" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6h16l-6 9v4l-4 1v-5l-6-9z" fill="#555" stroke="#555" stroke-width="2"/>
</svg>`;

const svgSort = `<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle">
    <g>
        <polygon points="12,6 9,11 15,11" fill="#888"/>
        <polygon points="12,18 9,13 15,13" fill="#888"/>
    </g>
</svg>`;

const svgSortAsc = `<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle">
    <polygon points="12,6 9,11 15,11" fill="#555"/>
</svg>`;

const svgSortDesc = `<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle">
    <polygon points="12,18 9,13 15,13" fill="#555"/>
</svg>`;

function getFilterIcon(isFiltered) {
    return isFiltered ? svgFilterFilled : svgFilter;
}

function getSortIcon(sortDir) {
    if (sortDir === 'asc') return svgSortAsc;
    if (sortDir === 'desc') return svgSortDesc;
    return svgSort;
}

// CACHE for parsed values to avoid repeated parsing
const valueCache = new Map();

function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === "number") return new Date(val);
    
    // Check cache first
    const cacheKey = `date_${val}`;
    if (valueCache.has(cacheKey)) {
        return valueCache.get(cacheKey);
    }
    
    let d = new Date(val);
    if (!isNaN(d)) {
        valueCache.set(cacheKey, d);
        return d;
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY format
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(val)) {
        let [d1, d2, d3] = val.split(/[-/]/);
        d = new Date(`${d3}-${d2}-${d1}`);
        if (!isNaN(d)) {
            valueCache.set(cacheKey, d);
            return d;
        }
    }
    
    // Try MM/DD/YYYY or MM-DD-YYYY format
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(val)) {
        let [m1, d1, y1] = val.split(/[-/]/);
        d = new Date(`${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`);
        if (!isNaN(d)) {
            valueCache.set(cacheKey, d);
            return d;
        }
    }
    
    valueCache.set(cacheKey, null);
    return null;
}

function formatValueForDisplay(val, colType) {
    if (val === null || val === undefined || val === '') return '';
    if (colType === 'date') {
        const d = parseDate(val);
        return d && !isNaN(d) ? d.toLocaleDateString() : val;
    } else if (colType === 'number') {
        const num = Number(val);
        return isNaN(num) ? val : num.toLocaleString();
    }
    return val.toString();
}

function normalizeValue(val, colType) {
    if (val === null || val === undefined || val === '') return null;
    
    const cacheKey = `norm_${colType}_${val}`;
    if (valueCache.has(cacheKey)) {
        return valueCache.get(cacheKey);
    }
    
    let result;
    if (colType === 'date') {
        const d = parseDate(val);
        result = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
    } else if (colType === 'number') {
        const num = Number(val);
        result = isNaN(num) ? null : num;
    } else {
        result = val.toString();
    }
    
    valueCache.set(cacheKey, result);
    return result;
}

// OPTIMIZED filter function with reduced operations
function tabulatorGlobalFilterFunction(data) {
    const filters = window.TabulatorGenericFilter.filterState;
    const typeMap = window.TabulatorGenericFilter.fieldTypeMap;
    
    for (const col in filters) {
        const f = filters[col];
        if (!f || (!f.type && (!f.inList || f.inList.length === 0))) continue;
        
        const val = data[col];
        const colType = typeMap[col] || "text";
        
        // Multi-select filter (most common case first)
        if (f.inList && f.inList.length > 0) {
            const normalizedVal = normalizeValue(val, colType);
            if (normalizedVal === null) return false;
            
            // Fixed: For numbers, ensure proper comparison
            if (colType === 'number') {
                // Convert inList values to numbers for comparison
                const numericInList = f.inList.map(v => Number(v));
                if (!numericInList.includes(normalizedVal)) return false;
            } else if (colType === 'date') {
                // For dates, compare as strings (ISO format)
                if (!f.inList.includes(normalizedVal)) return false;
            } else {
                // For text, ensure string comparison
                if (!f.inList.includes(normalizedVal.toString())) return false;
            }
        }
        
        // Value-based filters
        if (f.type && f.value !== null && f.value !== undefined && f.value !== '') {
            let v = val;
            let fv = f.value;
            let fv2 = f.value2;
            
            if (colType === 'date') {
                v = parseDate(val);
                fv = parseDate(f.value);
                fv2 = parseDate(f.value2);
            } else if (colType === 'number') {
                v = Number(val);
                fv = Number(f.value);
                fv2 = Number(f.value2);
                // Skip if values are not valid numbers
                if (isNaN(v) || isNaN(fv)) continue;
                if (f.type === 'between' && isNaN(fv2)) continue;
            }
            
            switch (f.type) {
                case "=":
                    if (colType === 'date') {
                        if (!v || !fv || v.toDateString() !== fv.toDateString()) return false;
                    } else if (colType === 'number') {
                        if (v !== fv) return false;
                    } else {
                        if (v != fv) return false;
                    }
                    break;
                case "!=":
                    if (colType === 'date') {
                        if (v && fv && v.toDateString() === fv.toDateString()) return false;
                    } else if (colType === 'number') {
                        if (v === fv) return false;
                    } else {
                        if (v == fv) return false;
                    }
                    break;
                case ">":
                    if (colType === 'date') {
                        if (!v || !fv || v <= fv) return false;
                    } else if (colType === 'number') {
                        if (v <= fv) return false;
                    } else {
                        if (v <= fv) return false;
                    }
                    break;
                case "<":
                    if (colType === 'date') {
                        if (!v || !fv || v >= fv) return false;
                    } else if (colType === 'number') {
                        if (v >= fv) return false;
                    } else {
                        if (v >= fv) return false;
                    }
                    break;
                case "between":
                    if (colType === 'date') {
                        if (!v || !fv || !fv2 || v < fv || v > fv2) return false;
                    } else if (colType === 'number') {
                        if (v < fv || v > fv2) return false;
                    } else {
                        if (v < fv || v > fv2) return false;
                    }
                    break;
                case "like":
                    if (!val?.toString().toLowerCase().includes(fv.toString().toLowerCase())) return false;
                    break;
                case "starts":
                    if (!val?.toString().toLowerCase().startsWith(fv.toString().toLowerCase())) return false;
                    break;
                case "ends":
                    if (!val?.toString().toLowerCase().endsWith(fv.toString().toLowerCase())) return false;
                    break;
            }
        }
    }
    return true;
}

window.TabulatorGenericFilter = {
    filterState: {},
    fieldTypeMap: {},
    isTableBuilt: false,
    updateTimeout: null, // For debouncing updates

    showFilterPopup(columnComponent, colType, anchorElem, tabulator) {
        if (window.currentFilterPopup) {
            window.currentFilterPopup.remove();
            window.currentFilterPopup = null;
        }

        const popup = document.createElement("div");
        popup.className = "tabulator-filter-popup";
        popup.style.cssText = `
            position: absolute;
            z-index: 10000;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            padding: 15px;
            min-width: 280px;
            max-width: 350px;
            max-height: 400px;
            overflow-y: auto;
        `;

        document.body.appendChild(popup);

        const rect = anchorElem.getBoundingClientRect();
        const popupWidth = 320;
        const popupHeight = 400;

        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 5;

        if (left + popupWidth > window.innerWidth) {
            left = window.innerWidth - popupWidth - 10;
        }
        if (top + popupHeight > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - popupHeight - 5;
        }

        popup.style.left = Math.max(10, left) + "px";
        popup.style.top = Math.max(10, top) + "px";

        window.currentFilterPopup = popup;

        const field = columnComponent.getField();
        const prevFilter = window.TabulatorGenericFilter.filterState[field] || {};

        // Filter Type Selection
        const typeLabel = document.createElement("div");
        typeLabel.textContent = "Filter Type:";
        typeLabel.style.cssText = "font-weight: bold; margin-bottom: 5px; font-size: 12px;";
        popup.appendChild(typeLabel);

        const typeSelect = document.createElement("select");
        typeSelect.className = "filter-select";
        typeSelect.style.cssText = "width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 3px;";

        const typeOptions = (colType === "number" || colType === "date")
            ? [
                { value: "=", text: "Equals" },
                { value: "!=", text: "Not Equal" },
                { value: ">", text: colType === "number" ? "Greater Than" : "After" },
                { value: "<", text: colType === "number" ? "Less Than" : "Before" },
                { value: "between", text: "Between" }
            ]
            : [
                { value: "like", text: "Contains" },
                { value: "=", text: "Equals" },
                { value: "!=", text: "Not Equal" },
                { value: "starts", text: "Starts With" },
                { value: "ends", text: "Ends With" }
            ];

        typeOptions.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.text = opt.text;
            if (prevFilter.type === opt.value) option.selected = true;
            typeSelect.appendChild(option);
        });
        popup.appendChild(typeSelect);

        // Value Input Section
        const valueLabel = document.createElement("div");
        valueLabel.textContent = "Value:";
        valueLabel.style.cssText = "font-weight: bold; margin-bottom: 5px; font-size: 12px;";
        popup.appendChild(valueLabel);

        const valueInput = document.createElement("input");
        valueInput.className = "filter-input";
        valueInput.type = colType === "number" ? "number" : (colType === "date" ? "date" : "text");
        valueInput.placeholder = "Enter value";
        valueInput.value = prevFilter.value || "";
        valueInput.style.cssText = "width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 3px;";
        popup.appendChild(valueInput);

        const valueInput2 = document.createElement("input");
        valueInput2.className = "filter-input";
        valueInput2.type = valueInput.type;
        valueInput2.placeholder = "To value";
        valueInput2.value = prevFilter.value2 || "";
        valueInput2.style.cssText = "width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 3px;";
        valueInput2.style.display = typeSelect.value === "between" ? "block" : "none";
        popup.appendChild(valueInput2);

        typeSelect.addEventListener("change", () => {
            valueInput2.style.display = typeSelect.value === "between" ? "block" : "none";
        });

        // Multi-select Section
        const multiSelectLabel = document.createElement("div");
        multiSelectLabel.textContent = "Select Values:";
        multiSelectLabel.style.cssText = "font-weight: bold; margin: 15px 0 5px 0; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px;";
        popup.appendChild(multiSelectLabel);

        // Search input for filtering checkboxes
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search values...";
        searchInput.style.cssText = "width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;";
        popup.appendChild(searchInput);

        let checkboxContainer = null;
        let selectAllCb = null;

        // FIXED: Better unique values handling for numbers
        function getUniqueValues() {
            const original = window.TabulatorGenericFilter.filterState[field];
            delete window.TabulatorGenericFilter.filterState[field];

            const allRows = tabulator.getData();
            const filteredRows = allRows.filter(row => tabulatorGlobalFilterFunction(row));

            if (original) {
                window.TabulatorGenericFilter.filterState[field] = original;
            }

            // Use Map for better value handling
            const uniqueValues = new Map();
            filteredRows.forEach(row => {
                const val = row[field];
                if (val !== null && val !== undefined && val !== "") {
                    const normalized = normalizeValue(val, colType);
                    if (normalized !== null) {
                        // Use the normalized value as key, but keep original for display
                        uniqueValues.set(normalized, val);
                    }
                }
            });

            // Convert to array and sort
            const sortedEntries = Array.from(uniqueValues.entries()).sort((a, b) => {
                const [normA] = a;
                const [normB] = b;
                if (colType === 'number') {
                    return Number(normA) - Number(normB);
                } else if (colType === 'date') {
                    return new Date(normA) - new Date(normB);
                } else {
                    return String(normA).localeCompare(String(normB));
                }
            });

            return sortedEntries.map(([normalized, original]) => ({ normalized, original }));
        }

        function renderCheckboxes() {
            if (checkboxContainer) checkboxContainer.remove();

            const allValues = getUniqueValues();
            checkboxContainer = document.createElement("div");
            checkboxContainer.className = "filter-checkbox-container";
            checkboxContainer.style.cssText = "max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 5px; border-radius: 3px;";

            // Select All checkbox
            const selectAllDiv = document.createElement("div");
            selectAllDiv.className = "checkbox-label";
            selectAllDiv.style.cssText = "padding: 3px 0; border-bottom: 1px solid #eee; margin-bottom: 5px; font-weight: bold;";

            selectAllCb = document.createElement("input");
            selectAllCb.type = "checkbox";
            selectAllCb.id = "select-all-" + field;

            const selectAllLabel = document.createElement("label");
            selectAllLabel.htmlFor = selectAllCb.id;
            selectAllLabel.textContent = " Select All";
            selectAllLabel.style.cssText = "cursor: pointer; font-size: 12px;";

            selectAllCb.addEventListener("change", function () {
                const visibleCheckboxes = Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]'))
                    .filter(cb => cb !== selectAllCb && cb.parentElement.style.display !== "none");
                visibleCheckboxes.forEach(cb => {
                    cb.checked = this.checked;
                });
            });

            selectAllDiv.appendChild(selectAllCb);
            selectAllDiv.appendChild(selectAllLabel);
            checkboxContainer.appendChild(selectAllDiv);

            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();

            // Individual value checkboxes
            allValues.forEach(({ normalized, original }) => {
                const label = document.createElement("label");
                label.className = "checkbox-label";
                label.style.cssText = "display: block; padding: 3px 0; cursor: pointer; font-size: 12px;";

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.style.cssText = "margin-right: 5px;";

                // FIXED: Store normalized value for filtering, but display original
                cb.value = normalized;
                cb.setAttribute('data-original-value', original);

                // Check if this value should be selected
                if (prevFilter.inList?.length > 0) {
                    // Convert both to same type for comparison
                    if (colType === 'number') {
                        cb.checked = prevFilter.inList.map(v => Number(v)).includes(Number(normalized));
                    } else {
                        cb.checked = prevFilter.inList.includes(normalized);
                    }
                }

                const displayValue = formatValueForDisplay(original, colType);
                label.appendChild(cb);
                label.appendChild(document.createTextNode(" " + displayValue));
                fragment.appendChild(label);
            });

            checkboxContainer.appendChild(fragment);
            popup.appendChild(checkboxContainer);

            // Update Select All state
            updateSelectAllState();

            // DEBOUNCED search functionality
            let searchTimeout;
            searchInput.addEventListener("input", () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const search = searchInput.value.toLowerCase();
                    Array.from(checkboxContainer.querySelectorAll(".checkbox-label")).forEach(label => {
                        if (label === selectAllDiv) return;
                        const text = label.textContent.toLowerCase();
                        label.style.display = text.includes(search) ? "block" : "none";
                    });
                    updateSelectAllState();
                }, 150);
            });

            // Add checkbox change listener to update Select All
            checkboxContainer.addEventListener("change", (e) => {
                if (e.target.type === "checkbox" && e.target !== selectAllCb) {
                    updateSelectAllState();
                }
            });
        }

        function updateSelectAllState() {
            const visibleCheckboxes = Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]'))
                .filter(cb => cb !== selectAllCb && cb.parentElement.style.display !== "none");
            const checkedVisible = visibleCheckboxes.filter(cb => cb.checked);

            if (checkedVisible.length === 0) {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = false;
            } else if (checkedVisible.length === visibleCheckboxes.length) {
                selectAllCb.checked = true;
                selectAllCb.indeterminate = false;
            } else {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = true;
            }
        }

        renderCheckboxes();

        // Buttons
        const btnDiv = document.createElement("div");
        btnDiv.className = "button-container";
        btnDiv.style.cssText = "margin-top: 15px; display: flex; gap: 10px; border-top: 1px solid #eee; padding-top: 10px;";

        const applyBtn = document.createElement("button");
        applyBtn.textContent = "Apply Filter";
        applyBtn.className = "btn-filter";
        applyBtn.type = "button";
        applyBtn.style.cssText = "flex: 1; padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;";

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear Filter";
        clearBtn.className = "btn-clear";
        clearBtn.type = "button";
        clearBtn.style.cssText = "flex: 1; padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;";

        btnDiv.appendChild(applyBtn);
        btnDiv.appendChild(clearBtn);
        popup.appendChild(btnDiv);

        // OPTIMIZED: Prevent double-clicks and batch operations
        let isProcessing = false;

        applyBtn.onclick = async () => {
            if (isProcessing) return;
            isProcessing = true;
            applyBtn.disabled = true;
            applyBtn.textContent = "Applying...";

            try {
                // Use requestAnimationFrame for smooth UI updates
                await new Promise(resolve => requestAnimationFrame(resolve));

                const selectedValues = checkboxContainer
                    ? Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]:checked'))
                        .filter(cb => cb.id !== selectAllCb?.id)
                        .map(cb => cb.value)
                    : [];

                const filter = {
                    type: typeSelect.value,
                    value: valueInput.value,
                    value2: valueInput2.value,
                    inList: selectedValues
                };

                // FIXED: Ensure proper type conversion for inList
                if (filter.inList.length > 0) {
                    filter.inList = [...new Set(filter.inList)]; // Remove duplicates
                    // Convert to proper types for storage
                    if (colType === 'number') {
                        filter.inList = filter.inList.map(v => Number(v));
                    } else if (colType === 'date') {
                        // Keep as strings for dates (ISO format)
                        filter.inList = filter.inList.map(v => v.toString());
                    } else {
                        filter.inList = filter.inList.map(v => v.toString());
                    }
                }

                if (filter.type && (filter.value || filter.value2) || filter.inList.length > 0) {
                    window.TabulatorGenericFilter.filterState[field] = filter;
                } else {
                    delete window.TabulatorGenericFilter.filterState[field];
                }

                // Apply filter and update UI
                tabulator.setFilter(tabulatorGlobalFilterFunction);
                window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);

                popup.remove();
                window.currentFilterPopup = null;
            } finally {
                isProcessing = false;
            }
        };

        clearBtn.onclick = async () => {
            if (isProcessing) return;
            isProcessing = true;
            clearBtn.disabled = true;
            clearBtn.textContent = "Clearing...";

            try {
                await new Promise(resolve => requestAnimationFrame(resolve));
                delete window.TabulatorGenericFilter.filterState[field];
                tabulator.setFilter(tabulatorGlobalFilterFunction);
                window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);
                popup.remove();
                window.currentFilterPopup = null;
            } finally {
                isProcessing = false;
            }
        };

        // Event cleanup
        setTimeout(() => {
            function handleClickOutside(e) {
                if (popup && !popup.contains(e.target) && !anchorElem.contains(e.target)) {
                    popup.remove();
                    window.currentFilterPopup = null;
                    document.removeEventListener("mousedown", handleClickOutside);
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
        }, 0);

        function handleEscapeKey(e) {
            if (e.key === 'Escape' && popup) {
                popup.remove();
                window.currentFilterPopup = null;
                document.removeEventListener("keydown", handleEscapeKey);
            }
        }
        document.addEventListener("keydown", handleEscapeKey);
    },

    headerFormatter(col, tabulator) {
        const field = col.field;
        const isFiltered = !!window.TabulatorGenericFilter.filterState[field];
        let sortDir = "";

        if (tabulator && window.TabulatorGenericFilter.isTableBuilt) {
            try {
                const sorters = tabulator.getSorters();
                const sorter = sorters.find(s => s.field === field);
                if (sorter) sortDir = sorter.dir;
            } catch (e) {
                console.warn("Could not get sorters:", e.message);
            }
        }

        return `
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;user-select:none;">
                <span class="column-title" style="flex-grow:1;text-align:left;">${col.title}</span>
                <span class="icon-group" style="display:flex;gap:2px;align-items:center;">
                    <span class="tabulator-filter-icon" title="Filter Column"
                        style="cursor:pointer;padding:2px;border-radius:2px;"
                        onmouseover="this.style.backgroundColor='#f0f0f0'"
                        onmouseout="this.style.backgroundColor='transparent'">${getFilterIcon(isFiltered)}</span>
                    <span class="tabulator-sort-icon" title="Sort Column"
                        style="cursor:pointer;padding:2px;border-radius:2px;"
                        onmouseover="this.style.backgroundColor='#f0f0f0'"
                        onmouseout="this.style.backgroundColor='transparent'">${getSortIcon(sortDir)}</span>
                </span>
            </div>
        `;
    },

    // DEBOUNCED header updates to prevent excessive DOM manipulation
    scheduleHeaderUpdate(tabulator) {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
            this.updateHeaders(tabulator);
        }, 100);
    },

    updateHeaders(tabulator) {
        if (!tabulator || !window.TabulatorGenericFilter.isTableBuilt) return;

        try {
            // Use requestAnimationFrame for smooth updates
            requestAnimationFrame(() => {
                const columns = tabulator.getColumns();
                columns.forEach(col => {
                    try {
                        const field = col.getField();
                        const definition = col.getDefinition();
                        if (definition.titleFormatter) {
                            // Get the header element more safely
                            const headerElement = col.getElement();
                            if (headerElement) {
                                const titleElement = headerElement.querySelector('.tabulator-col-title');
                                if (titleElement) {
                                    titleElement.innerHTML = this.headerFormatter(definition, tabulator);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Could not update header for column:", e.message);
                    }
                });
            });
        } catch (e) {
            console.warn("Could not update headers:", e.message);
        }
    },
    attachFilterIcons(tabulator, columns) {
        columns.forEach(col => {
            col.titleFormatter = () => window.TabulatorGenericFilter.headerFormatter(col, tabulator);
            col.headerClick = function (e, columnComponent) {
                const target = e.target;
                if (target.closest(".tabulator-filter-icon")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const field = columnComponent.getField();
                    const colType = window.TabulatorGenericFilter.fieldTypeMap[field] || "text";
                    window.TabulatorGenericFilter.showFilterPopup(columnComponent, colType, target,
                        tabulator);
                } else if (target.closest(".tabulator-sort-icon")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const field = columnComponent.getField();
                    let dir = "asc";
                    if (window.TabulatorGenericFilter.isTableBuilt) {
                        try {
                            const sorters = tabulator.getSorters();
                            const sorter = sorters.find(s => s.field === field);
                            if (sorter) {
                                if (sorter.dir === "asc") dir = "desc";
                                else if (sorter.dir === "desc") dir = "";
                                else dir = "asc";
                            }
                        } catch (e) { }
                    }
                    if (dir) {
                        tabulator.setSort(field, dir);
                    } else {
                        tabulator.clearSort();
                    }
                    window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);
                }
            };
        });

        if (tabulator) {
            tabulator.on("tableBuilt", () => {
                window.TabulatorGenericFilter.isTableBuilt = true;
                // Use throttled event handlers
                let sortTimeout;
                tabulator.on("sortChanged", () => {
                    clearTimeout(sortTimeout);
                    sortTimeout = setTimeout(() => {
                        window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);
                    }, 50);
                });

                let filterTimeout;
                tabulator.on("dataFiltered", () => {
                    clearTimeout(filterTimeout);
                    filterTimeout = setTimeout(() => {
                        window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);
                    }, 50);
                });
            });
        }
    },

    clearAllFilters(tabulator) {
        window.TabulatorGenericFilter.filterState = {};
        valueCache.clear(); // Clear cache when clearing filters
        tabulator.clearFilter();
        window.TabulatorGenericFilter.scheduleHeaderUpdate(tabulator);
    },

    getActiveFilters() {
        return Object.keys(window.TabulatorGenericFilter.filterState).filter(
            key => window.TabulatorGenericFilter.filterState[key]
        );
    },

    // Method to clear cache if needed
    clearCache() {
        valueCache.clear();
    }
};