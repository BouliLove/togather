import React, { useState, useEffect, useRef } from "react";
import { MapPin, X, Bike, Car, Train, Footprints, Plus, Loader, Share2, Search, ChevronDown, Users, Clock, Star, Navigation, Menu } from 'lucide-react';
import axios from 'axios';
// Import Autocomplete and the loader hook
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';

// --- Constants ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';
const BACKEND_URL = "https://api.togather.fr";
const MAP_CENTER = { lat: 48.8566, lng: 2.3522 }; // Center of Paris

// Define the libraries to load
const LIBRARIES = ["places"];

// Define the bounds for Greater Paris to restrict Autocomplete results
const PARIS_BOUNDS = {
  north: 48.9021449,
  south: 48.8155734,
  east: 2.4699208,
  west: 2.224199,
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

const TravelModes = {
  WALKING: { icon: <Footprints size={18} />, label: "Walking", className: "transport-walking" },
  BICYCLING: { icon: <Bike size={18} />, label: "Bicycling", className: "transport-bicycling" },
  TRANSIT: { icon: <Train size={18} />, label: "Transit", className: "transport-transit" },
  DRIVING: { icon: <Car size={18} />, label: "Driving", className: "transport-driving" }
};

const COLORS = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#D946EF', '#06B6D4', '#84CC16'];

// --- Helper Function for Numbered Markers ---
const createNumberedMarkerIcon = (number, color) => {
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="21" font-size="16" font-weight="bold" font-family="Arial" fill="white" text-anchor="middle">${number}</text>
    </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(32, 32),
    anchor: new window.google.maps.Point(16, 16),
  };
};

// --- Main App Component ---
const App = () => {
  // --- State Management ---
  const [locations, setLocations] = useState([
    { id: 1, address: "", transport: "WALKING", color: COLORS[0], position: null },
    { id: 2, address: "", transport: "WALKING", color: COLORS[1], position: null }
  ]);
  
  const [bestLocations, setBestLocations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState("form");
  const [venueType, setVenueType] = useState("");
  const [error, setError] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Ref to store Autocomplete instances
  const autocompleteRefs = useRef({});

  // --- Google Maps Loader Hook ---
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  // --- Handlers ---
  const onAutocompleteLoad = (autocomplete, id) => {
    autocompleteRefs.current[id] = autocomplete;
  };

  const onPlaceChanged = (id) => {
    const autocomplete = autocompleteRefs.current[id];
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place && place.geometry) {
        setLocations(prev => prev.map(loc => 
          loc.id === id ? { 
            ...loc, 
            address: place.formatted_address, 
            position: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }
          } : loc
        ));
      }
    }
  };
  
  const handleAddressChange = (id, value) => {
    // This now only handles manual text input, clearing the position
    setLocations(prev => prev.map(loc => 
      loc.id === id ? { ...loc, address: value, position: null } : loc
    ));
  };
  
  // ... (Other handlers like handleAddAddress, handleRemoveAddress, etc. remain the same) ...

  const handleAddAddress = () => {
    if (locations.length < 8) {
      setLocations([...locations, { id: Date.now(), address: '', transport: 'WALKING', color: COLORS[locations.length % COLORS.length], position: null }]);
    }
  };

  const handleRemoveAddress = (id) => {
    if (locations.length > 2) {
      setLocations(locations.filter(loc => loc.id !== id));
      delete autocompleteRefs.current[id];
    }
  };

  const handleToggleTravelMode = (id) => {
    setLocations(locations.map(loc => {
      if (loc.id === id) {
        const modes = Object.keys(TravelModes);
        const nextIndex = (modes.indexOf(loc.transport) + 1) % modes.length;
        return { ...loc, transport: modes[nextIndex] };
      }
      return loc;
    }));
  };

  const handleFindMeetingPoint = async () => {
    const validAddresses = locations.filter(a => a.address.trim() !== "" && a.position);
    if (validAddresses.length < 2) {
      setError("Please select at least two valid addresses from the suggestions.");
      return;
    }
    // ... (rest of the function is the same) ...
    setIsCalculating(true);
    setError(null);
    setBestLocations([]);
    try {
      const response = await axios.post(`${BACKEND_URL}/compute-location`, {
        venueType: venueType,
        locations: validAddresses.map(addr => ({ address: addr.address, transport: addr.transport.toLowerCase() }))
      });
      const result = response.data.bestLocation;
      setBestLocations([{ ...result }]);
      setIsCalculating(false);
      if (window.innerWidth < 768) {
        setViewMode("map");
      }
    } catch (err) {
      console.error('Error finding meeting point:', err);
      setError(err.response?.data?.error || 'Failed to find meeting point. Please try again.');
      setIsCalculating(false);
    }
  };
  
  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setShowMobileMenu(false);
  };
  
  // --- Map-related Computations ---
  const getMapCenter = () => {
    if (bestLocations.length > 0) return bestLocations[0].location;
    const validLocations = locations.filter(l => l.position);
    if (validLocations.length > 0) {
        const lat = validLocations.reduce((sum, l) => sum + l.position.lat, 0) / validLocations.length;
        const lng = validLocations.reduce((sum, l) => sum + l.position.lng, 0) / validLocations.length;
        return { lat, lng };
    }
    return MAP_CENTER;
  };

  const getMapZoom = () => (bestLocations.length > 0 || locations.some(l => l.position)) ? 12 : 11;

  // This will now create all the markers for the map
  const allMapMarkers = [
    // Create numbered markers for starting points
    ...locations
      .filter(loc => loc.position)
      .map((loc, index) => ({
        id: loc.id,
        position: loc.position,
        title: `Person ${index + 1}: ${loc.address.split(',')[0]}`,
        type: 'start',
        icon: createNumberedMarkerIcon(index + 1, loc.color),
      })),
    // Create a special marker for the result location
    ...(bestLocations.length > 0 ? [{
      id: 'selected',
      position: bestLocations[0].location,
      title: bestLocations[0].name,
      type: 'destination',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="40" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 0C8.5 0 0 8.5 0 19C0 33.25 19 48 19 48S38 33.25 38 19C38 8.5 29.5 0 19 0Z" fill="#10B981"/>
            <circle cx="19" cy="19" r="8" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(38, 48),
        anchor: new window.google.maps.Point(19, 48),
      }
    }] : [])
  ];

  // --- Render Logic ---
  const renderMap = () => {
    if (loadError) return <div>Error loading maps. Please check your API key and internet connection.</div>;
    if (!isLoaded) {
      return (
        <div className="map-display">
          <div className="map-placeholder">
            <Loader className="loading-spinner" size={48} style={{ color: '#3b82f6', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '14px' }}>Loading Google Maps...</p>
          </div>
        </div>
      );
    }
    return (
      <GoogleMap mapContainerStyle={mapContainerStyle} center={getMapCenter()} zoom={getMapZoom()} options={mapOptions}>
        {allMapMarkers.map((marker) => (
          <Marker key={marker.id} position={marker.position} title={marker.title} icon={marker.icon} onClick={() => setSelectedMarker(marker)} />
        ))}
        {selectedMarker && (
          <InfoWindow position={selectedMarker.position} onCloseClick={() => setSelectedMarker(null)}>
            <div style={{ padding: '8px', maxWidth: '200px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600' }}>{selectedMarker.title}</h4>
              {selectedMarker.type === 'destination' && bestLocations.length > 0 && (
                 <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>{bestLocations[0].address}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    );
  };
  
  return (
    <div className="togather-app">
      {/* Header (No changes needed) */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-logo"><div className="logo-icon"><MapPin size={18} color="white" /></div><h1 className="logo-text">Togather</h1></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="header-stats">
              <div className="stat-item"><Users size={14} /><span>{locations.filter(l => l.address).length} people</span></div>
              {bestLocations.length > 0 && (<div className="stat-item"><Clock size={14} /><span>{Math.round(bestLocations[0].averageTime / 60)} min avg</span></div>)}
            </div>
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="mobile-menu-btn"><Menu size={20} /></button>
            {(locations.some(l=>l.position) || bestLocations.length > 0) && (<button onClick={toggleView} className="view-toggle-btn"><Navigation size={16} /><span>{viewMode === "form" ? "View Map" : "Back to Form"}</span></button>)}
          </div>
        </div>
        {showMobileMenu && (
          <div className="mobile-dropdown">
            <div className="mobile-stats">
              <div className="stat-item"><Users size={14} /><span>{locations.filter(l => l.address).length} people</span></div>
              {bestLocations.length > 0 && (<div className="stat-item"><Clock size={14} /><span>{Math.round(bestLocations[0].averageTime / 60)} min avg</span></div>)}
            </div>
            {(locations.some(l=>l.position) || bestLocations.length > 0) && (<button onClick={toggleView} className="mobile-view-toggle"><Navigation size={16} /><span>{viewMode === "form" ? "View Map" : "Back to Form"}</span></button>)}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="main-content">
        <div className={`form-panel ${viewMode === "map" ? "hidden-mobile" : ""}`}>
          <div className="mobile-map-preview">{renderMap()}</div>
          <div className="form-content">
            <div className="venue-section">
              <label className="venue-label">What kind of place?</label>
              <div className="venue-input-container">
                <MapPin className="venue-input-icon" size={18} />
                <input type="text" placeholder="restaurant, café, park..." value={venueType} onChange={(e) => setVenueType(e.target.value)} className="venue-input" />
              </div>
            </div>
            {error && (<div className="error-message">{error}</div>)}
            <div className="starting-points-section">
              <h2 className="section-title">Starting Points</h2>
              <div className="locations-list">
                {locations.map((location, index) => (
                  <div key={location.id} className="location-item">
                    <div className="location-card">
                      <div className="location-color" style={{ backgroundColor: location.color }} />
                      <div className="location-input-container">
                        <Search className="location-input-icon" size={16} />
                        {isLoaded && (
                          <Autocomplete
                            onLoad={(autocomplete) => onAutocompleteLoad(autocomplete, location.id)}
                            onPlaceChanged={() => onPlaceChanged(location.id)}
                            options={{ bounds: PARIS_BOUNDS, strictBounds: true }}
                          >
                            <input
                              type="text"
                              value={location.address}
                              onChange={(e) => handleAddressChange(location.id, e.target.value)}
                              placeholder={`Person ${index + 1}'s location...`}
                              className="location-input"
                            />
                          </Autocomplete>
                        )}
                      </div>
                      <button onClick={() => handleToggleTravelMode(location.id)} className={`transport-btn ${TravelModes[location.transport]?.className}`} title={TravelModes[location.transport]?.label}>{TravelModes[location.transport]?.icon}</button>
                      {locations.length > 2 && (<button onClick={() => handleRemoveAddress(location.id)} className="remove-btn"><X size={16} /></button>)}
                    </div>
                  </div>
                ))}
              </div>
              {locations.length < 8 && (<button onClick={handleAddAddress} className="add-person-btn"><Plus size={20} /><span>Add another person</span></button>)}
            </div>
            <button onClick={handleFindMeetingPoint} disabled={isCalculating} className="find-btn">
              {isCalculating ? (<><Loader className="loading-spinner" size={20} /><span>Finding best spot...</span></>) : (<><MapPin size={20} /><span>Find Meeting Point</span></>)}
            </button>
            {/* Results section (no changes needed) */}
            {bestLocations.length > 0 && bestLocations[0] && (
              <div className="results-section">
                <div className="results-header">
                  <div className="results-header-content"><h3 className="results-title">Perfect Meeting Spot!</h3><div className="results-time-badge"><Clock size={16} /><span>{Math.round(bestLocations[0].averageTime / 60)} min avg</span></div></div>
                </div>
                <div className="results-content">
                  <h4 className="venue-name">{bestLocations[0].name}</h4><p className="venue-address">{bestLocations[0].address}</p>
                  {bestLocations[0].rating && (
                    <div className="venue-rating"><div className="rating-stars"><Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} /><span className="rating-text">{bestLocations[0].rating}</span></div><span className="rating-count">({bestLocations[0].userRatingsTotal} reviews)</span></div>
                  )}
                  <div className="travel-times-section">
                    <h5 className="travel-times-title">Travel times:</h5>
                    <div className="travel-times-list">
                      {locations.map((entry, i) => {
                        if (!entry.address) return null;
                        const travelTime = bestLocations[0].travelTimes?.[i];
                        const minutes = travelTime ? Math.round(travelTime / 60) : 'N/A';
                        return (
                          <div key={i} className="travel-time-item">
                            <div className="travel-time-from"><div className="travel-time-color" style={{ backgroundColor: entry.color }} /><span className="travel-time-address">{entry.address.split(',')[0]}</span></div>
                            <div className="travel-time-details"><span className="travel-time-value">{minutes} min</span><div className={`travel-mode-icon ${TravelModes[entry.transport]?.className}`}>{React.cloneElement(TravelModes[entry.transport]?.icon, { size: 12 })}</div></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button className="share-btn"><Share2 size={18} /><span>Share Meeting Point</span></button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={`map-panel ${viewMode === "form" ? "hidden-mobile" : ""}`}>
          {renderMap()}
          {viewMode === "map" && (<button onClick={toggleView} className="back-to-form-btn"><ChevronDown size={16} /><span>Back to Form</span></button>)}
        </div>
      </div>
    </div>
  );
};

export default App;