// ==========================================================================
// SAVORSYNC FRONTEND APPLICATION LOGIC
// ==========================================================================

// Global state
const state = {
    cities: [],
    localitiesByCity: {},
    cuisines: [],
    filters: {
        search: '',
        city: '',
        locality: '',
        cuisine: '',
        minRating: 3.0,
        maxCost: 3000
    },
    selectedRestaurant: null,
    similarWeight: 0.6 // Content similarity weight (0.6 content, 0.4 popularity)
};

// UI Element selectors
const el = {
    datasetName: document.getElementById('dataset-name'),
    datasetCount: document.getElementById('dataset-count'),
    restaurantsGrid: document.getElementById('restaurants-grid'),
    gridTitle: document.getElementById('grid-title'),
    resultsCount: document.getElementById('results-count'),
    
    // Filters
    searchInput: document.getElementById('search-input'),
    citySelect: document.getElementById('city-select'),
    localityGroup: document.getElementById('locality-group'),
    localitySelect: document.getElementById('locality-select'),
    cuisineSelect: document.getElementById('cuisine-select'),
    ratingSlider: document.getElementById('rating-slider'),
    ratingVal: document.getElementById('rating-val'),
    costSlider: document.getElementById('cost-slider'),
    costVal: document.getElementById('cost-val'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    // Similar Recommendations Modal
    similarModal: document.getElementById('similar-modal'),
    btnOpenUpload: document.getElementById('btn-open-upload'),
    btnCloseSimilar: document.getElementById('btn-close-similar'),
    selectedRestName: document.getElementById('selected-rest-name'),
    selectedRestMeta: document.getElementById('selected-rest-meta'),
    similarGrid: document.getElementById('similar-grid'),
    weightSlider: document.getElementById('weight-slider'),
    weightBubble: document.getElementById('weight-bubble'),
    
    // Upload CSV Modal
    uploadModal: document.getElementById('upload-modal'),
    btnCloseUpload: document.getElementById('btn-close-upload'),
    dragDropZone: document.getElementById('drag-drop-zone'),
    fileInput: document.getElementById('file-input'),
    progressContainer: document.getElementById('upload-progress-container'),
    progressFill: document.getElementById('progress-fill'),
    progressStatus: document.getElementById('progress-status'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    showSkeletons(el.restaurantsGrid, 8);
    await fetchConfig();
    fetchRestaurants();
}

// Fetch configuration metadata from the server
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        state.cities = config.cities;
        state.cuisines = config.cuisines;
        state.localitiesByCity = config.localities_by_city;
        
        // Update stats
        el.datasetName.textContent = config.current_dataset;
        el.datasetCount.textContent = config.num_records.toLocaleString();
        
        // Populate selectors
        populateDropdown(el.citySelect, state.cities, 'All Cities');
        populateDropdown(el.cuisineSelect, state.cuisines, 'All Cuisines');
        
        // Hide locality group by default
        el.localityGroup.style.display = 'none';
        el.localitySelect.innerHTML = '<option value="">All Localities</option>';
        
    } catch (error) {
        showToast('Error connecting to backend server', 'error');
        console.error('Config fetch failed:', error);
    }
}

// Helper: Populate HTML Select elements
def = null;
function populateDropdown(selectElement, items, defaultText) {
    let html = `<option value="">${defaultText}</option>`;
    items.forEach(item => {
        html += `<option value="${item}">${item}</option>`;
    });
    selectElement.innerHTML = html;
}

// ==========================================================================
// FILTERS AND RESTAURANT FETCHING
// ==========================================================================

// Fetch filtered restaurants list from API
async function fetchRestaurants() {
    showSkeletons(el.restaurantsGrid, 8);
    
    // Build query params
    const params = new URLSearchParams();
    if (state.filters.search) params.append('name', state.filters.search); // Wait, search matches names in front-end search or API? Let's check API.
    // In API we have cuisine, city, locality, min_rating, max_cost.
    // Let's filter on frontend or send correct arguments.
    // In app.py: get_restaurants() handles: cuisine, city, locality, min_rating, max_cost.
    // Let's map search term as well. Wait, we can filter names on the frontend or backend! Let's pass parameters.
    
    if (state.filters.city) params.append('city', state.filters.city);
    if (state.filters.locality) params.append('locality', state.filters.locality);
    if (state.filters.cuisine) params.append('cuisine', state.filters.cuisine);
    params.append('min_rating', state.filters.minRating);
    if (state.filters.maxCost < 3000) params.append('max_cost', state.filters.maxCost);
    params.append('top_n', 30); // Request top 30
    
    try {
        const response = await fetch(`/api/restaurants?${params.toString()}`);
        let data = await response.json();
        
        // Client-side search keyword filtering on restaurant name (in addition to filters)
        if (state.filters.search) {
            const query = state.filters.search.toLowerCase();
            data = data.filter(r => r.name.toLowerCase().includes(query) || r.cuisines.toLowerCase().includes(query));
        }
        
        renderRestaurants(data);
        
    } catch (error) {
        showToast('Error loading restaurants', 'error');
        console.error('Fetch restaurants failed:', error);
    }
}

// Render cards list in grid
function renderRestaurants(restaurants) {
    el.restaurantsGrid.innerHTML = '';
    
    if (!restaurants || restaurants.length === 0) {
        el.resultsCount.textContent = 'Showing 0 matches';
        el.restaurantsGrid.innerHTML = `
            <div class="no-results">
                <i class="fa-regular fa-face-frown"></i>
                <h3>No Restaurants Found</h3>
                <p>Try relaxing your filters or searching for something else.</p>
            </div>
        `;
        return;
    }
    
    el.resultsCount.textContent = `Showing ${restaurants.length} matches`;
    
    restaurants.forEach(r => {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        
        // Determine theme class and emoji based on cuisines
        const cuisineTheme = getCuisineTheme(r.cuisines);
        const emoji = getCuisineEmoji(r.cuisines);
        const ratingColor = getRatingColor(r.aggregate_rating);
        
        card.innerHTML = `
            <div class="card-visual visual-theme-${cuisineTheme}">
                <span>${emoji}</span>
                <div class="card-rating-badge" style="background-color: ${ratingColor}">
                    ${Number(r.aggregate_rating).toFixed(1)} <i class="fa-solid fa-star"></i>
                </div>
            </div>
            <div class="card-info">
                <h3>${r.name}</h3>
                <p class="card-locality"><i class="fa-solid fa-location-dot"></i> ${r.locality}, ${r.city}</p>
                <p class="card-cuisines">${r.cuisines}</p>
            </div>
            <div class="card-footer">
                <div class="card-cost">
                    Cost for two: <span>${r.cost_for_two > 0 ? '₹' + r.cost_for_two : 'N/A'}</span>
                </div>
                <div class="card-popularity">
                    <i class="fa-solid fa-fire"></i> ${r.votes} votes
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => openSimilarModal(r));
        el.restaurantsGrid.appendChild(card);
    });
}

// Show skeleton loading cards
function showSkeletons(container, count) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        container.appendChild(skeleton);
    }
}

// =====================================================
// SIMILAR RECOMMENDATIONS (MODAL WINDOW)
// =====================================================

function openSimilarModal(restaurant) {
    state.selectedRestaurant = restaurant;
    
    // Update labels
    el.selectedRestName.textContent = restaurant.name;
    
    const ratingColor = getRatingColor(restaurant.aggregate_rating);
    el.selectedRestMeta.innerHTML = `
        <span class="rating-pill" style="background-color: rgba(255,255,255,0.06); color: ${ratingColor}">
            ${Number(restaurant.aggregate_rating).toFixed(1)} ★
        </span>
        <span>${restaurant.cuisines}</span>
        <span>•</span>
        <span>${restaurant.locality}, ${restaurant.city}</span>
    `;
    
    // Reset weight slider to default state (0.6 Content)
    state.similarWeight = 0.6;
    el.weightSlider.value = 0.6;
    updateWeightUI(0.6);
    
    // Fetch and show
    fetchSimilarRecommendations();
    
    el.similarModal.showModal();
}

async function fetchSimilarRecommendations() {
    el.similarGrid.innerHTML = '';
    showSkeletons(el.similarGrid, 4);
    
    const params = new URLSearchParams({
        name: state.selectedRestaurant.name,
        content_weight: state.similarWeight,
        top_n: 8
    });
    
    try {
        const response = await fetch(`/api/recommend_similar?${params.toString()}`);
        const data = await response.json();
        renderSimilar(data);
    } catch (error) {
        showToast('Error loading similar restaurants', 'error');
        console.error('Fetch similar failed:', error);
    }
}

function renderSimilar(recommendations) {
    el.similarGrid.innerHTML = '';
    
    if (!recommendations || recommendations.length === 0) {
        el.similarGrid.innerHTML = `
            <div class="no-results" style="padding: 30px 10px;">
                <i class="fa-regular fa-face-frown" style="font-size: 32px;"></i>
                <p>No similar items found in the dataset.</p>
            </div>
        `;
        return;
    }
    
    recommendations.forEach(r => {
        const card = document.createElement('div');
        card.className = 'similar-card';
        
        const ratingColor = getRatingColor(r.aggregate_rating);
        const matchPct = Math.round((r.hybrid_score || 0) * 100);
        
        card.innerHTML = `
            <h4>${r.name}</h4>
            <div class="meta">
                <i class="fa-solid fa-location-dot" style="font-size: 9px; color: var(--secondary)"></i> 
                ${r.locality}, ${r.city}
            </div>
            <div class="cuisine">${r.cuisines}</div>
            <div class="matching-score">
                <span style="color: ${ratingColor}">${Number(r.aggregate_rating).toFixed(1)} ★</span>
                <span>Match: ${matchPct}%</span>
            </div>
        `;
        el.similarGrid.appendChild(card);
    });
}

function updateWeightUI(weight) {
    const contentPct = Math.round(weight * 100);
    const popPct = 100 - contentPct;
    el.weightBubble.textContent = `${contentPct}% Content / ${popPct}% Popularity`;
    
    // Positioning the bubble over the slider thumb is tricky with HTML inputs, 
    // so we just update the text content and style
}

// =====================================================
// FILE UPLOAD AND RETRAINING
// =====================================================

// Perform CSV file upload to Flask
async function uploadCSVFile(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
        showToast('Unsupported file. Please upload a .csv file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    el.progressContainer.style.display = 'block';
    el.dragDropZone.style.display = 'none';
    el.progressFill.style.style = '0%';
    el.progressStatus.textContent = 'Uploading CSV file to server...';
    
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                el.progressFill.style.width = `${percent}%`;
                el.progressStatus.textContent = `Uploading dataset... ${percent}%`;
            }
        };
        
        xhr.onload = async () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showToast(response.message, 'success');
                el.uploadModal.close();
                
                // Re-initialize app details with new dataset
                await initApp();
            } else {
                let errMsg = 'File upload failed';
                try {
                    const response = JSON.parse(xhr.responseText);
                    errMsg = response.error || errMsg;
                } catch(e) {}
                showToast(errMsg, 'error');
                resetUploadModal();
            }
        };
        
        xhr.onerror = () => {
            showToast('Network error during file upload', 'error');
            resetUploadModal();
        };
        
        xhr.send(formData);
        
    } catch (error) {
        showToast('Failed to upload file', 'error');
        resetUploadModal();
        console.error('Upload failed:', error);
    }
}

function resetUploadModal() {
    el.progressContainer.style.display = 'none';
    el.dragDropZone.style.display = 'flex';
    el.progressFill.style.width = '0%';
    el.fileInput.value = '';
}

// ==========================================================================
// LISTENERS & UTILITIES
// ==========================================================================

function setupEventListeners() {
    // City filter triggers locality population
    el.citySelect.addEventListener('change', (e) => {
        const selectedCity = e.target.value;
        state.filters.city = selectedCity;
        state.filters.locality = ''; // Reset locality on city change
        
        if (selectedCity && state.localitiesByCity[selectedCity]) {
            populateDropdown(el.localitySelect, state.localitiesByCity[selectedCity], 'All Localities');
            el.localityGroup.style.display = 'flex';
        } else {
            el.localityGroup.style.display = 'none';
        }
        fetchRestaurants();
    });
    
    // Filter connections
    el.localitySelect.addEventListener('change', (e) => {
        state.filters.locality = e.target.value;
        fetchRestaurants();
    });
    
    el.cuisineSelect.addEventListener('change', (e) => {
        state.filters.cuisine = e.target.value;
        fetchRestaurants();
    });
    
    // Sliders
    el.ratingSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value).toFixed(1);
        el.ratingVal.textContent = `${val} ★`;
        state.filters.minRating = parseFloat(val);
    });
    el.ratingSlider.addEventListener('change', fetchRestaurants);
    
    el.costSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (val >= 3000) {
            el.costVal.textContent = 'Any';
            state.filters.maxCost = 3000;
        } else {
            el.costVal.textContent = `₹${val}`;
            state.filters.maxCost = val;
        }
    });
    el.costSlider.addEventListener('change', fetchRestaurants);
    
    // Debounced search typing
    let searchTimeout;
    el.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        state.filters.search = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            fetchRestaurants();
        }, 300);
    });
    
    // Reset Filters
    el.btnResetFilters.addEventListener('click', () => {
        el.searchInput.value = '';
        el.citySelect.value = '';
        el.localitySelect.value = '';
        el.cuisineSelect.value = '';
        el.ratingSlider.value = 3.0;
        el.ratingVal.textContent = '3.0 ★';
        el.costSlider.value = 3000;
        el.costVal.textContent = 'Any';
        
        el.localityGroup.style.display = 'none';
        
        state.filters = {
            search: '',
            city: '',
            locality: '',
            cuisine: '',
            minRating: 3.0,
            maxCost: 3000
        };
        fetchRestaurants();
    });
    
    // Similar model hybrid weight slider tuning
    el.weightSlider.addEventListener('input', (e) => {
        const weight = parseFloat(e.target.value);
        state.similarWeight = weight;
        updateWeightUI(weight);
    });
    el.weightSlider.addEventListener('change', () => {
        fetchSimilarRecommendations();
    });
    
    // Modal controls
    el.btnOpenUpload.addEventListener('click', () => {
        resetUploadModal();
        el.uploadModal.showModal();
    });
    el.btnCloseUpload.addEventListener('click', () => el.uploadModal.close());
    el.btnCloseSimilar.addEventListener('click', () => el.similarModal.close());
    
    // Dialog backdrop clicks to close
    window.addEventListener('click', (e) => {
        if (e.target === el.similarModal) el.similarModal.close();
        if (e.target === el.uploadModal) el.uploadModal.close();
    });
    
    // Drag & Drop File upload listeners
    el.dragDropZone.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadCSVFile(e.target.files[0]);
        }
    });
    
    el.dragDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.dragDropZone.classList.add('dragover');
    });
    
    el.dragDropZone.addEventListener('dragleave', () => {
        el.dragDropZone.classList.remove('dragover');
    });
    
    el.dragDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.dragDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            uploadCSVFile(e.dataTransfer.files[0]);
        }
    });
}

// Cuisine color themes mapping
function getCuisineTheme(cuisines) {
    if (!cuisines) return 'default';
    const c = cuisines.toLowerCase();
    if (c.includes('indian')) return 'indian';
    if (c.includes('italian') || c.includes('pizza') || c.includes('pasta')) return 'italian';
    if (c.includes('japanese') || c.includes('sushi') || c.includes('ramen')) return 'japanese';
    if (c.includes('mexican') || c.includes('tacos')) return 'mexican';
    if (c.includes('chinese') || c.includes('asian') || c.includes('dumplings')) return 'chinese';
    if (c.includes('cafe') || c.includes('bakery') || c.includes('coffee') || c.includes('french')) return 'cafe';
    return 'default';
}

// Cuisine icons mapping
function getCuisineEmoji(cuisines) {
    if (!cuisines) return '🍽️';
    const c = cuisines.toLowerCase();
    if (c.includes('indian')) return '🍛';
    if (c.includes('pizza')) return '🍕';
    if (c.includes('pasta') || c.includes('italian')) return '🍝';
    if (c.includes('sushi')) return '🍣';
    if (c.includes('ramen') || c.includes('japanese')) return '🍜';
    if (c.includes('tacos') || c.includes('mexican')) return '🌮';
    if (c.includes('burger')) return '🍔';
    if (c.includes('chinese') || c.includes('asian')) return '🥢';
    if (c.includes('bakery') || c.includes('french') || c.includes('cafe')) return '☕';
    if (c.includes('seafood')) return '🐟';
    if (c.includes('steak')) return '🥩';
    if (c.includes('salad')) return '🥗';
    if (c.includes('dessert') || c.includes('cake') || c.includes('sweet')) return '🍰';
    return '🍽️';
}

// Rating color mapping
function getRatingColor(rating) {
    const r = parseFloat(rating);
    if (r >= 4.2) return 'var(--rating-high)';
    if (r >= 3.6) return 'var(--rating-mid)';
    return 'var(--rating-low)';
}

// Toast notification helper
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') {
        icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    el.toastContainer.appendChild(toast);
    
    // Fade out after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
