import React, { useState, useRef, useEffect } from "react";
import { MapPin, X, Bike, Car, Train, Footprints, Plus, Loader, Share2, Search, ChevronUp, ChevronDown, Users, Clock, Star, Navigation, Menu } from 'lucide-react';
import axios from 'axios';

// Mock MapDisplay component
const MapDisplay = ({ center, zoom, markers, selectedLocation, className }) => (
  <div className={`map-display ${className}`}>
    <div className="map-placeholder">
      <MapPin size={48} style={{ color: '#3b82f6', margin: '0 auto 8px' }} />
      <p style={{ fontSize: '14px' }}>Google Maps would render here</p>
      <p style={{ fontSize: '12px', marginTop: '4px' }}>{markers?.length || 0} markers</p>
    </div>
  </div>
);

// Constants
const BACKEND_URL = "https://api.togather.fr"

const MAP_CENTER = { lat: 48.8566, lng: 2.3522 };

const TravelModes = {
  WALKING: { icon: <Footprints size={18} />, label: "Walking", className: "transport-walking" },
  BICYCLING: { icon: <Bike size={18} />, label: "Bicycling", className: "transport-bicycling" },
  TRANSIT: { icon: <Train size={18} />, label: "Transit", className: "transport-transit" },
  DRIVING: { icon: <Car size={18} />, label: "Driving", className: "transport-driving" }
};

const COLORS = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

const App = () => {
  // State management
  const [locations, setLocations] = useState([
    { id: 1, address: "", transport: "WALKING", color: COLORS[0] },
    { id: 2, address: "", transport: "WALKING", color: COLORS[1] }
  ]);
  
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState("form");
  const [venueType, setVenueType] = useState("");
  const [error, setError] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Handlers
  const handleAddAddress = () => {
    if (locations.length < 8) {
      setLocations([...locations, { 
        id: Date.now(), 
        address: '', 
        transport: 'WALKING',
        color: COLORS[locations.length % COLORS.length]
      }]);
    }
  };

  const handleRemoveAddress = (id) => {
    if (locations.length > 2) {
      setLocations(locations.filter(loc => loc.id !== id));
    }
  };

  const handleAddressChange = (id, value) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, address: value } : loc
    ));
  };

  const handleToggleTravelMode = (id) => {
    setLocations(locations.map(loc => {
      if (loc.id === id) {
        const modes = Object.keys(TravelModes);
        const currentIndex = modes.indexOf(loc.transport);
        const nextIndex = (currentIndex + 1) % modes.length;
        return { ...loc, transport: modes[nextIndex] };
      }
      return loc;
    }));
  };

  const handleFindMeetingPoint = async () => {
    const validAddresses = locations.filter(a => a.address.trim() !== "");
    if (validAddresses.length < 2) {
      setError("Please enter at least two valid addresses");
      return;
    }
  
    setIsCalculating(true);
    setError(null);
    
    try {
      // Real API call to your backend
      const response = await axios.post(`${BACKEND_URL}/compute-location`, {
        locations: validAddresses.map(addr => ({
          address: addr.address,
          transport: addr.transport.toLowerCase()
        }))
      });
      
      const result = response.data.bestLocation;
      
      // Format the result to match your frontend expectations
      setBestLocations([{
        name: result.name,
        address: result.address,
        location: result.location,
        averageTime: result.averageTime,
        rating: result.rating || null,
        userRatingsTotal: result.userRatingsTotal || null,
        travelTimes: result.travelTimes,
        placeId: result.placeId
      }]);
      
      setIsCalculating(false);
      
      // Switch to map view on mobile
      if (window.innerWidth < 768) {
        setViewMode("map");
      }
      
    } catch (error) {
      console.error('Error finding meeting point:', error);
      setError(error.response?.data?.error || 'Failed to find meeting point. Please try again.');
      setIsCalculating(false);
    }
  };

  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setShowMobileMenu(false);
  };

  return (
    <div className="togather-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-logo">
            <div className="logo-icon">
              <MapPin size={18} color="white" />
            </div>
            <h1 className="logo-text">Togather</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Stats - Desktop */}
            <div className="header-stats">
              <div className="stat-item">
                <Users size={14} />
                <span>{locations.filter(l => l.address).length} people</span>
              </div>
              {bestLocations.length > 0 && (
                <div className="stat-item">
                  <Clock size={14} />
                  <span>{Math.round(bestLocations[0].averageTime / 60)} min avg</span>
                </div>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>
            
            {/* View Toggle - Desktop */}
            {(markers.length > 0 || bestLocations.length > 0) && (
              <button 
                onClick={toggleView}
                className="view-toggle-btn"
              >
                <Navigation size={16} />
                <span>{viewMode === "form" ? "View Map" : "Back to Form"}</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Dropdown Menu */}
        {showMobileMenu && (
          <div className="mobile-dropdown">
            <div className="mobile-stats">
              <div className="stat-item">
                <Users size={14} />
                <span>{locations.filter(l => l.address).length} people</span>
              </div>
              {bestLocations.length > 0 && (
                <div className="stat-item">
                  <Clock size={14} />
                  <span>{Math.round(bestLocations[0].averageTime / 60)} min avg</span>
                </div>
              )}
            </div>
            {(markers.length > 0 || bestLocations.length > 0) && (
              <button 
                onClick={toggleView}
                className="mobile-view-toggle"
              >
                <Navigation size={16} />
                <span>{viewMode === "form" ? "View Map" : "Back to Form"}</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Form Panel */}
        <div className={`form-panel ${viewMode === "map" ? "hidden-mobile" : ""}`}>
          {/* Map Preview - Mobile Only */}
          <div className="mobile-map-preview">
            <MapDisplay
              center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
              zoom={markers.length > 0 ? 11 : 10}
              markers={markers}
              selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
              className="w-full h-full"
            />
            <div className="mobile-map-overlay" />
            <button
              onClick={toggleView}
              className="expand-map-btn"
            >
              Expand Map
            </button>
          </div>

          {/* Form Content */}
          <div className="form-content">
            {/* Venue Type */}
            <div className="venue-section">
              <label className="venue-label">
                What kind of place?
              </label>
              <div className="venue-input-container">
                <MapPin className="venue-input-icon" size={18} />
                <input
                  type="text"
                  placeholder="restaurant, café, park..."
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="venue-input"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Starting Points */}
            <div className="starting-points-section">
              <h2 className="section-title">Starting Points</h2>
              
              <div className="locations-list">
                {locations.map((location, index) => (
                  <div key={location.id} className="location-item">
                    <div className="location-card">
                      {/* Color indicator */}
                      <div 
                        className="location-color"
                        style={{ backgroundColor: location.color }}
                      />
                      
                      {/* Address Input */}
                      <div className="location-input-container">
                        <Search className="location-input-icon" size={16} />
                        <input
                          type="text"
                          value={location.address}
                          onChange={(e) => handleAddressChange(location.id, e.target.value)}
                          placeholder={`Person ${index + 1}'s location...`}
                          className="location-input"
                        />
                      </div>
                      
                      {/* Transport Mode Button */}
                      <button
                        onClick={() => handleToggleTravelMode(location.id)}
                        className={`transport-btn ${TravelModes[location.transport]?.className}`}
                        title={TravelModes[location.transport]?.label}
                      >
                        {TravelModes[location.transport]?.icon}
                      </button>
                      
                      {/* Remove Button */}
                      {locations.length > 2 && (
                        <button
                          onClick={() => handleRemoveAddress(location.id)}
                          className="remove-btn"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add Person Button */}
              {locations.length < 8 && (
                <button
                  onClick={handleAddAddress}
                  className="add-person-btn"
                >
                  <Plus size={20} />
                  <span>Add another person</span>
                </button>
              )}
            </div>

            {/* Find Meeting Point Button */}
            <button
              onClick={handleFindMeetingPoint}
              disabled={isCalculating}
              className="find-btn"
            >
              {isCalculating ? (
                <>
                  <Loader className="loading-spinner" size={20} />
                  <span>Finding best spot...</span>
                </>
              ) : (
                <>
                  <MapPin size={20} />
                  <span>Find Meeting Point</span>
                </>
              )}
            </button>

            {/* Results */}
            {bestLocations.length > 0 && bestLocations[0] && (
              <div className="results-section">
                {/* Header */}
                <div className="results-header">
                  <div className="results-header-content">
                    <h3 className="results-title">Perfect Meeting Spot!</h3>
                    <div className="results-time-badge">
                      <Clock size={16} />
                      <span>
                        {Math.round(bestLocations[0].averageTime / 60)} min avg
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="results-content">
                  <h4 className="venue-name">
                    {bestLocations[0].name}
                  </h4>
                  <p className="venue-address">
                    {bestLocations[0].address}
                  </p>
                  
                  {/* Rating */}
                  {bestLocations[0].rating && (
                    <div className="venue-rating">
                      <div className="rating-stars">
                        <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                        <span className="rating-text">
                          {bestLocations[0].rating}
                        </span>
                      </div>
                      <span className="rating-count">
                        ({bestLocations[0].userRatingsTotal} reviews)
                      </span>
                    </div>
                  )}
                  
                  {/* Travel Times */}
                  <div className="travel-times-section">
                    <h5 className="travel-times-title">Travel times:</h5>
                    <div className="travel-times-list">
                      {locations.map((entry, index) => {
                        if (!entry.address) return null;
                        
                        const travelTime = bestLocations[0].travelTimes?.[index];
                        const minutes = travelTime ? Math.round(travelTime / 60) : 'N/A';
                        
                        return (
                          <div key={index} className="travel-time-item">
                            <div className="travel-time-from">
                              <div 
                                className="travel-time-color"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="travel-time-address">
                                {entry.address.split(',')[0]}
                              </span>
                            </div>
                            <div className="travel-time-details">
                              <span className="travel-time-value">{minutes} min</span>
                              <div className={`travel-mode-icon ${TravelModes[entry.transport]?.className}`}>
                                {React.cloneElement(TravelModes[entry.transport]?.icon, { size: 12 })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Share Button */}
                  <button className="share-btn">
                    <Share2 size={18} />
                    <span>Share Meeting Point</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map Panel */}
        <div className={`map-panel ${viewMode === "form" ? "hidden-mobile" : ""}`}>
          <MapDisplay
            center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
            zoom={markers.length > 0 ? 11 : 10}
            markers={markers}
            selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
            className="w-full h-full"
          />
          
          {/* Back to Form Button - Mobile */}
          {viewMode === "map" && (
            <button
              onClick={toggleView}
              className="back-to-form-btn"
            >
              <ChevronDown size={16} />
              <span>Back to Form</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;