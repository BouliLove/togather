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

  const onLoad = (autocomplete, index) => {
    autocompleteRefs.current[index] = autocomplete;
  };

  const onPlaceChanged = (index) => {
    if (autocompleteRefs.current[index]) {
      const place = autocompleteRefs.current[index].getPlace();
      if (place.geometry) {
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
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/compute-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: addresses }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Error from backend:", error);
        return;
      }
      const data = await response.json();
      setBestLocations([data.bestLocation]);
      // Switch to map view when result is ready on mobile
      setViewMode("map");
    } catch (error) {
      console.error("Error connecting to backend:", error);
    }
  };

  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setMapExpanded(false);
  };
  
  const toggleMapExpanded = () => {
    setMapExpanded(!mapExpanded);
  };

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

        <div className={`app-container ${viewMode}`}>
          {/* FORM CONTAINER */}
          <div className="form-container">
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
                        <option value="transit">Public Transport</option>
                      </select>
                    </div>
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
                >
                  Find best meeting point
                </button>
              )}
            </div>
            
            {/* Meeting Point Details */}
            {bestLocations.length > 0 && (
              <div className="meeting-details">
                <h2>Best Meeting Point</h2>
                <p><strong>{bestLocations[0].name || "Meeting Point"}</strong></p>
                <p>{bestLocations[0].address || "Address not available"}</p>
                <p>Avg travel: {(bestLocations[0].averageTime / 60).toFixed(1)} min</p>
                <hr />
                <h3>Commute times:</h3>
                <ul className="commute-times-list">
                  {addresses.map((entry, index) => (
                    <li key={index}>
                      {entry.address.length > 25 ? entry.address.substring(0, 25) + "..." : entry.address}:{" "}
                      {bestLocations[0].travelTimes[index] !== Infinity
                        ? (bestLocations[0].travelTimes[index] / 60).toFixed(1)
                        : "N/A"}{" "}
                      min ({entry.transport})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* MAP CONTAINER */}
          <div className="map-container">
            <GoogleMap
              mapContainerClassName="google-map"
              center={MAP_CENTER}
              zoom={12}
              options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
            >
              {markers.map((position, index) => (
                <Marker key={index} position={position} />
              ))}
              {bestLocations.length > 0 && (
                <Marker
                  position={bestLocations[0].location}
                  icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                  onClick={() => setMeetingInfoOpen(true)}
                />
              )}
              {meetingInfoOpen && bestLocations.length > 0 && (
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
          </div>
        </div>
      </div>
    </LoadScript>
  );
};

export default App;