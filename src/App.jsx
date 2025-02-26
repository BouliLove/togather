import React, { useState, useRef } from "react";
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
  const [addresses, setAddresses] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [meetingInfoOpen, setMeetingInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" or "map"
  const [mapExpanded, setMapExpanded] = useState(false); // For mini-map toggle on mobile
  const [venueType, setVenueType] = useState(""); // New state for venue type
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [error, setError] = useState(null); // Error state
  const [selectedVenue, setSelectedVenue] = useState(0); // Index of selected venue from alternatives
  const autocompleteRefs = useRef([]);

  const handleAddAddress = () => {
    if (addresses.length < 10) {
      setAddresses([...addresses, { address: "", transport: "transit" }]);
    }
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
    autocompleteRefs.current[index] = autocomplete;
  };

  const onPlaceChanged = (index) => {
    if (autocompleteRefs.current[index]) {
      const place = autocompleteRefs.current[index].getPlace();
      if (place && place.geometry) {
        const { lat, lng } = place.geometry.location;
        handleAddressChange(index, place.formatted_address || "");
        setMarkers((prevMarkers) => {
          const newMarkers = [...prevMarkers];
          newMarkers[index] = { lat: lat(), lng: lng() };
          return newMarkers;
        });
      }
    }
  };

  const handleCompute = async () => {
    // Validate we have at least 2 addresses
    if (addresses.filter(a => a.address.trim() !== "").length < 2) {
      setError("Please enter at least two valid addresses");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/compute-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          locations: addresses,
          venueType: venueType.trim() // Send venue type to backend
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
      setSelectedVenue(0); // Reset selected venue to the best one
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

  const selectAlternativeVenue = (index) => {
    if (bestLocations[0] && bestLocations[0].alternativeVenues && 
        bestLocations[0].alternativeVenues[index]) {
      setSelectedVenue(index + 1);
      
      // Update the marker on the map
      const venue = bestLocations[0].alternativeVenues[index];
      setMeetingInfoOpen(true);
    }
  };

  // Get the currently selected venue (best or alternative)
  const getCurrentVenue = () => {
    if (!bestLocations[0]) return null;
    
    if (selectedVenue === 0) {
      return bestLocations[0];
    } else if (bestLocations[0].alternativeVenues && bestLocations[0].alternativeVenues[selectedVenue - 1]) {
      return bestLocations[0].alternativeVenues[selectedVenue - 1];
    }
    
    return bestLocations[0];
  };

  const currentVenue = getCurrentVenue();

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={["places"]}>
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
              <GoogleMap
                mapContainerClassName="mini-google-map"
                center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                zoom={markers.length > 0 ? 11 : 10}
                options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: false }}
              >
                {markers.map((position, index) => (
                  <Marker key={index} position={position} />
                ))}
                {bestLocations.length > 0 && currentVenue && (
                  <Marker
                    position={currentVenue.location}
                    icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                  />
                )}
              </GoogleMap>
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
                What kind of place are you looking for?
              </label>
              <input
                id="venue-type"
                type="text" 
                placeholder="e.g., restaurant, cinema, park, tennis..." 
                value={venueType}
                onChange={handleVenueTypeChange}
                className="venue-type-input"
              />
            </div>
            
            {/* Rows Container */}
            <div className="address-rows">
              {addresses.map((entry, index) => (
                <div key={index} className="address-row">
                  <div className="address-input-group">
                    <div className="address-input">
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