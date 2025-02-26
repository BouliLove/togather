import React, { useState, useRef } from "react";
import { LoadScript } from "@react-google-maps/api";
import "./App.css";
import MapDisplay from "./components/MapDisplay";
import AddressInputs from "./components/AddressInputs";

const MAP_CENTER = { lat: 48.8566, lng: 2.3522 }; // Paris

const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#373737" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d47a1" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
];

const App = () => {
  // Get environment variables
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
  
  // State management
  const [addresses, setAddresses] = useState([{ address: "", transport: "transit" }]);
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [meetingInfoOpen, setMeetingInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" or "map"
  const [mapExpanded, setMapExpanded] = useState(false); // For mini-map toggle on mobile
  const [venueType, setVenueType] = useState(""); // New state for venue type
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [error, setError] = useState(null); // Error state
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(null);
  
  // Handle adding a new address row
  const handleAddAddress = () => {
    if (addresses.length < 10) {
      setAddresses([...addresses, { address: "", transport: "transit" }]);
    }
  };

  // Handle removing an address row
  const handleRemoveAddress = (index) => {
    if (addresses.length <= 1) return; // Don't remove if it's the last one
    
    const newAddresses = [...addresses];
    newAddresses.splice(index, 1);
    setAddresses(newAddresses);
    
    const newMarkers = [...markers];
    newMarkers.splice(index, 1);
    setMarkers(newMarkers);
  };

  // Handle updating address values
  const handleAddressChange = (index, value) => {
    const newAddresses = [...addresses];
    newAddresses[index].address = value;
    setAddresses(newAddresses);
  };

  // Handle updating transport mode
  const handleTransportChange = (index, transport) => {
    const newAddresses = [...addresses];
    newAddresses[index].transport = transport;
    setAddresses(newAddresses);
  };

  // Handle venue type input changes
  const handleVenueTypeChange = (e) => {
    setVenueType(e.target.value);
  };

  // Handle place selection from autocomplete
  const handlePlaceSelect = (place, index) => {
    try {
      if (place && place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        // Update the address with formatted address
        handleAddressChange(index, place.formatted_address || "");
        
        // Update markers
        const newMarkers = [...markers];
        newMarkers[index] = { lat, lng };
        setMarkers(newMarkers);
      }
    } catch (error) {
      console.error("Error handling place selection:", error);
    }
  };

  // Handle compute button click - calculate best meeting point
  const handleCompute = async () => {
    // Validate we have at least 2 addresses
    const validAddresses = addresses.filter(a => a.address.trim() !== "");
    if (validAddresses.length < 2) {
      setError("Please enter at least two valid addresses");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Sending request to:", backendUrl);
      const response = await fetch(`${backendUrl}/compute-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          locations: addresses,
          venueType: venueType.trim() // Send venue type to backend
        }),
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to find meeting point";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status})`;
        }
        setError(errorMessage);
        return;
      }
      
      const data = await response.json();
      setBestLocations([data.bestLocation]);
      
      // Switch to map view when result is ready on mobile
      setViewMode("map");
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setError("Connection error. Please check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle map/form view toggling
  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setMapExpanded(false);
  };
  
  // Handle mini-map expansion on mobile
  const toggleMapExpanded = () => {
    setMapExpanded(!mapExpanded);
  };

  // Google Maps loading handlers
  const handleMapsLoad = () => {
    console.log("Google Maps API loaded successfully");
    setMapsLoaded(true);
  };

  const handleMapsError = (error) => {
    console.error("Google Maps loading error:", error);
    setMapsLoadError(`Failed to load Google Maps: ${error}`);
  };

  // If there's no Google Maps API key, show an error
  if (!googleMapsApiKey) {
    return (
      <div className="togather-app">
        <header className="app-header">
          <h1>Togather</h1>
        </header>
        <div className="config-error">
          <h2>Configuration Error</h2>
          <p>Google Maps API key is missing. Please check your environment configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="togather-app">
      <header className="app-header">
        <h1>Togather</h1>
        {(markers.length > 0 || bestLocations.length > 0) && (
          <button onClick={toggleView} className="view-toggle-btn">
            {viewMode === "form" ? "View Map" : "Back to Form"}
          </button>
        )}
      </header>

      {/* Wrap everything in a single LoadScript component */}
      <LoadScript
        googleMapsApiKey={googleMapsApiKey}
        libraries={["places"]}
        onLoad={handleMapsLoad}
        onError={handleMapsError}
        loadingElement={
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Loading Google Maps...</p>
          </div>
        }
      >
        <div className={`app-container ${viewMode} ${mapExpanded ? 'map-expanded' : ''}`}>
          {/* Mini Map Preview (mobile only) */}
          <div className="mini-map-container">
            <div className="mini-map-wrapper">
              {mapsLoaded && (
                <MapDisplay
                  center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                  zoom={markers.length > 0 ? 11 : 10}
                  markers={markers}
                  selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
                  mapStyles={MAP_STYLES}
                  className="mini-google-map"
                  disableDefaultUI={true}
                  zoomControl={false}
                />
              )}
              <button 
                className="expand-map-btn" 
                onClick={toggleMapExpanded}
                aria-label={mapExpanded ? "Minimize map" : "Expand map"}
              >
                {mapExpanded ? "↓" : "↑"}
              </button>
            </div>
          </div>
          
          {/* FORM CONTAINER */}
          <div className="form-container">
            {/* Venue Type Input */}
            <div className="venue-type-container">
              <label htmlFor="venue-type" className="venue-type-label">
                What kind of place to meet at?
              </label>
              <input
                id="venue-type"
                type="text" 
                placeholder="e.g., restaurant, cinema, cafe, park..." 
                value={venueType}
                onChange={handleVenueTypeChange}
                className="venue-type-input"
              />
            </div>
            
            {/* Error message if any */}
            {(error || mapsLoadError) && (
              <div className="error-message">
                {error || mapsLoadError}
              </div>
            )}
            
            {/* Starting Points Heading */}
            <div className="section-heading">
              <h2>Starting Points</h2>
            </div>
            
            {/* Address inputs with autocomplete */}
            <AddressInputs
              addresses={addresses}
              mapsLoaded={mapsLoaded}
              onAddressChange={handleAddressChange}
              onTransportChange={handleTransportChange}
              onPlaceSelect={handlePlaceSelect}
              onRemoveAddress={handleRemoveAddress}
            />
            
            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={handleAddAddress}
                disabled={addresses.length >= 10 || isLoading}
                className="add-address-btn"
              >
                Add start point
              </button>
              {addresses.length >= 2 && (
                <button
                  onClick={handleCompute}
                  className="compute-btn"
                  disabled={isLoading || mapsLoadError !== null}
                >
                  {isLoading ? "Finding..." : "Find best meeting point"}
                </button>
              )}
            </div>
            
            {/* Meeting Point Details */}
            {bestLocations.length > 0 && bestLocations[0] && (
              <div className="meeting-details">
                <div className="meeting-header">
                  <h2>Best Meeting Point</h2>
                  <span className="time-badge">{(bestLocations[0].averageTime / 60).toFixed(1)} min</span>
                </div>
                
                <div className="venue-info">
                  <h3>{bestLocations[0].name || "Meeting Point"}</h3>
                  <p className="venue-address">{bestLocations[0].address || "Address not available"}</p>
                  {bestLocations[0].rating && (
                    <div className="venue-rating">
                      <span className="rating-stars">
                        {"★".repeat(Math.round(bestLocations[0].rating))}
                        {"☆".repeat(5 - Math.round(bestLocations[0].rating))}
                      </span>
                      <span className="rating-value">{bestLocations[0].rating}</span>
                      {bestLocations[0].userRatingsTotal && (
                        <span className="rating-count">({bestLocations[0].userRatingsTotal})</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="commute-details">
                  <h4>Commute times:</h4>
                  <ul className="commute-times-list">
                    {addresses.map((entry, index) => {
                      if (!entry.address) return null;
                      
                      // Format address for display
                      let displayAddress = entry.address;
                      const commaIndex = displayAddress.indexOf(',');
                      if (commaIndex > 0) {
                        displayAddress = displayAddress.substring(0, commaIndex);
                      } else if (displayAddress.length > 25) {
                        displayAddress = displayAddress.substring(0, 25) + "...";
                      }
                      
                      // Get travel time
                      const travelTime = bestLocations[0].travelTimes && bestLocations[0].travelTimes[index];
                      const formattedTime = travelTime !== undefined && travelTime !== Infinity
                        ? (travelTime / 60).toFixed(1)
                        : "N/A";
                      
                      return (
                        <li key={index} className="commute-item">
                          <div className="commute-address">{displayAddress}</div>
                          <div className="commute-time">
                            <span className="time-value">{formattedTime} min</span>
                            <span className="transport-mode">({entry.transport})</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                
                {bestLocations[0].alternativeVenues && bestLocations[0].alternativeVenues.length > 0 && (
                  <div className="alternative-venues">
                    <h4>Alternative venues nearby:</h4>
                    <ul className="alternative-venues-list">
                      {bestLocations[0].alternativeVenues.map((venue, index) => (
                        <li key={index} className="alternative-venue-item">
                          <span className="venue-name">{venue.name}</span>
                          <span className="venue-time">{(venue.averageTime / 60).toFixed(1)} min</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* MAP CONTAINER */}
          <div className="map-container">
            {mapsLoaded && (
              <MapDisplay
                center={bestLocations.length > 0 && bestLocations[0].location 
                  ? bestLocations[0].location 
                  : markers.length > 0 
                    ? markers[markers.length - 1] 
                    : MAP_CENTER}
                zoom={12}
                markers={markers}
                selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
                mapStyles={MAP_STYLES}
                showInfoWindow={meetingInfoOpen}
                onInfoWindowClose={() => setMeetingInfoOpen(false)}
                onMarkerClick={() => setMeetingInfoOpen(true)}
              />
            )}
            {!mapsLoaded && !mapsLoadError && (
              <div className="map-loading">Loading Google Maps...</div>
            )}
            {mapsLoadError && (
              <div className="map-error">
                <p>Error loading Google Maps: {mapsLoadError}</p>
              </div>
            )}
          </div>
        </div>
      </LoadScript>
    </div>
  );
};

export default App;