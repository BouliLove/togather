import React, { useState, useRef, useEffect } from "react";
import { LoadScript, Autocomplete, GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import "./App.css";

const ILE_DE_FRANCE_BOUNDS = {
  north: 49.1,
  south: 48.0,
  west: 1.5,
  east: 3.5,
};

const MAP_CENTER = { lat: 48.8566, lng: 2.3522 };

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
  // App states
  const [addresses, setAddresses] = useState([{ address: "", transport: "transit" }]);
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [meetingInfoOpen, setMeetingInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" or "map"
  const [mapExpanded, setMapExpanded] = useState(false); // For mini-map toggle on mobile
  const [venueType, setVenueType] = useState(""); // Type of venue
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [error, setError] = useState(null); // Error state
  
  // Loading states for APIs
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(true);

  // Get API key from environment
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
  
  const autocompleteRefs = useRef([]);

  // Validate configuration on startup
  useEffect(() => {
    // Check if Google Maps API key is configured
    if (!googleMapsApiKey) {
      setMapsError("Google Maps API key is missing. Please check your environment configuration.");
      console.error("VITE_GOOGLE_MAPS_API_KEY is missing");
    }
    
    // Validate backend connectivity
    const checkBackend = async () => {
      try {
        // Simple HEAD request to check if backend is available
        const response = await fetch(`${backendUrl}`, { method: 'HEAD' });
        if (!response.ok) {
          setBackendAvailable(false);
          setError("Backend service appears to be unavailable.");
          console.error("Backend connectivity issue:", response.status);
        }
      } catch (err) {
        setBackendAvailable(false);
        setError("Could not connect to backend service.");
        console.error("Backend connection error:", err);
      }
    };
    
    // Only check backend if we have a key (to avoid multiple errors)
    if (googleMapsApiKey) {
      checkBackend();
    }
  }, [googleMapsApiKey, backendUrl]);

  const handleAddAddress = () => {
    if (addresses.length < 10) {
      setAddresses([...addresses, { address: "", transport: "transit" }]);
    }
  };

  const handleRemoveAddress = (index) => {
    if (addresses.length <= 1) return; // Don't remove if it's the last one
    
    const newAddresses = [...addresses];
    newAddresses.splice(index, 1);
    setAddresses(newAddresses);
    
    const newMarkers = [...markers];
    newMarkers.splice(index, 1);
    setMarkers(newMarkers);
  };

  const handleAddressChange = (index, value) => {
    const newAddresses = [...addresses];
    newAddresses[index].address = value;
    setAddresses(newAddresses);
  };

  const handleTransportChange = (index, transport) => {
    const newAddresses = [...addresses];
    newAddresses[index].transport = transport;
    setAddresses(newAddresses);
  };

  const handleVenueTypeChange = (e) => {
    setVenueType(e.target.value);
  };

  const onLoad = (autocomplete, index) => {
    if (autocomplete) {
      autocompleteRefs.current[index] = autocomplete;
    }
  };

  const onPlaceChanged = (index) => {
    try {
      if (autocompleteRefs.current[index]) {
        const place = autocompleteRefs.current[index].getPlace();
        if (place && place.geometry && place.geometry.location) {
          const { lat, lng } = place.geometry.location;
          handleAddressChange(index, place.formatted_address || "");
          
          const newMarkers = [...markers];
          newMarkers[index] = { lat: lat(), lng: lng() };
          setMarkers(newMarkers);
        }
      }
    } catch (err) {
      console.error("Error in onPlaceChanged:", err);
      setError("Error selecting place. Please try again.");
    }
  };

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
      const response = await fetch(`${backendUrl}/compute-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          locations: addresses,
          venueType: venueType.trim()
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error from backend:", errorData);
        setError(errorData.error || "Failed to find meeting point");
        return;
      }
      
      const data = await response.json();
      setBestLocations([data.bestLocation]);
      
      // Switch to map view when result is ready on mobile
      setViewMode("map");
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setMapExpanded(false);
  };
  
  const toggleMapExpanded = () => {
    setMapExpanded(!mapExpanded);
  };

  const handleMapsLoaded = () => {
    setMapsLoaded(true);
    console.log("Google Maps API loaded successfully");
  };

  const handleMapsError = (error) => {
    setMapsError(`Failed to load Google Maps: ${error}`);
    console.error("Google Maps loading error:", error);
  };

  // If there's a configuration error, show it immediately
  if (mapsError) {
    return (
      <div className="togather-app error-container">
        <header className="app-header">
          <h1>Togather</h1>
        </header>
        <div className="config-error">
          <h2>Configuration Error</h2>
          <p>{mapsError}</p>
          <p>Please check your environment variables and ensure VITE_GOOGLE_MAPS_API_KEY is properly set.</p>
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

      <div className={`app-container ${viewMode} ${mapExpanded ? 'map-expanded' : ''}`}>
        {/* Mini Map Preview (mobile only) */}
        <div className="mini-map-container">
          <div className="mini-map-wrapper">
            {googleMapsApiKey && (
              <LoadScript 
                googleMapsApiKey={googleMapsApiKey}
                libraries={["places"]}
                onLoad={handleMapsLoaded}
                onError={handleMapsError}
              >
                <GoogleMap
                  mapContainerClassName="mini-google-map"
                  center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                  zoom={markers.length > 0 ? 11 : 10}
                  options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: false }}
                >
                  {markers.map((position, index) => (
                    <Marker key={index} position={position} />
                  ))}
                  {bestLocations.length > 0 && bestLocations[0].location && (
                    <Marker
                      position={bestLocations[0].location}
                      icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                    />
                  )}
                </GoogleMap>
              </LoadScript>
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
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {/* Config info for debugging */}
          {import.meta.env.DEV && (
            <div className="debug-info">
              <div>Maps API Key: {googleMapsApiKey ? '✅ Configured' : '❌ Missing'}</div>
              <div>Backend URL: {backendUrl}</div>
              <div>Backend Status: {backendAvailable ? '✅ Available' : '❌ Unreachable'}</div>
            </div>
          )}
          
          {/* Starting Points Heading */}
          <div className="section-heading">
            <h2>Starting Points</h2>
          </div>
          
          {/* Rows Container */}
          <div className="address-rows">
            {addresses.map((entry, index) => (
              <div key={index} className="address-row">
                <div className="address-input-group">
                  <div className="address-input">
                    {googleMapsApiKey && (
                      <LoadScript 
                        googleMapsApiKey={googleMapsApiKey} 
                        libraries={["places"]}
                        onLoad={handleMapsLoaded}
                        onError={handleMapsError}
                      >
                        <Autocomplete
                          onLoad={(autocomplete) => onLoad(autocomplete, index)}
                          onPlaceChanged={() => onPlaceChanged(index)}
                          options={{
                            bounds: new window.google.maps.LatLngBounds(
                              { lat: ILE_DE_FRANCE_BOUNDS.south, lng: ILE_DE_FRANCE_BOUNDS.west },
                              { lat: ILE_DE_FRANCE_BOUNDS.north, lng: ILE_DE_FRANCE_BOUNDS.east }
                            ),
                            strictBounds: true,
                            componentRestrictions: { country: "FR" },
                          }}
                        >
                          <input
                            type="text"
                            placeholder={`Address ${index + 1}`}
                            value={entry.address}
                            onChange={(e) => handleAddressChange(index, e.target.value)}
                            className="address-input-field"
                          />
                        </Autocomplete>
                      </LoadScript>
                    )}
                    
                    {!googleMapsApiKey && (
                      <input
                        type="text"
                        placeholder={`Address ${index + 1}`}
                        value={entry.address}
                        onChange={(e) => handleAddressChange(index, e.target.value)}
                        className="address-input-field"
                        disabled={!googleMapsApiKey}
                      />
                    )}
                  </div>
                  <div className="transport-select">
                    <select
                      value={entry.transport}
                      onChange={(e) => handleTransportChange(index, e.target.value)}
                      className="transport-select-field"
                    >
                      <option value="driving">Car</option>
                      <option value="walking">Walking</option>
                      <option value="bicycling">Bicycle</option>
                      <option value="transit">Transit</option>
                    </select>
                  </div>
                  {addresses.length > 1 && (
                    <button 
                      onClick={() => handleRemoveAddress(index)} 
                      className="remove-address-btn"
                      aria-label="Remove address"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={handleAddAddress}
              disabled={addresses.length >= 10}
              className="add-address-btn"
            >
              Add start point
            </button>
            {addresses.length >= 2 && (
              <button
                onClick={handleCompute}
                className="compute-btn"
                disabled={isLoading || !googleMapsApiKey || !backendAvailable}
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
          {googleMapsApiKey && (
            <LoadScript 
              googleMapsApiKey={googleMapsApiKey} 
              libraries={["places"]}
              onLoad={handleMapsLoaded}
              onError={handleMapsError}
            >
              <GoogleMap
                mapContainerClassName="google-map"
                center={bestLocations.length > 0 && bestLocations[0].location ? bestLocations[0].location : 
                       markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                zoom={12}
                options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
              >
                {markers.map((position, index) => (
                  <Marker key={index} position={position} />
                ))}
                {bestLocations.length > 0 && bestLocations[0].location && (
                  <Marker
                    position={bestLocations[0].location}
                    icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                    onClick={() => setMeetingInfoOpen(true)}
                  />
                )}
                {meetingInfoOpen && bestLocations.length > 0 && bestLocations[0].location && (
                  <InfoWindow
                    position={bestLocations[0].location}
                    onCloseClick={() => setMeetingInfoOpen(false)}
                  >
                    <div className="info-window-content">
                      <h3>{bestLocations[0].name || "Meeting Point"}</h3>
                      <p>{bestLocations[0].address || "Address not available"}</p>
                      <p>Average travel time: {(bestLocations[0].averageTime / 60).toFixed(1)} min</p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </LoadScript>
          )}
          
          {!googleMapsApiKey && (
            <div className="map-error-container">
              <p>Google Maps API key is missing. Please check your configuration.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;