import React, { useState, useRef } from "react";
import { LoadScript, Autocomplete, GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";

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
      fetch(`${backendUrl}/compute-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: addresses, venueQuery }),
      })

  
      if (!response.ok) {
        const error = await response.json();
        console.error("Error from backend:", error);
        return;
      }
  
      const data = await response.json();
      // The server returns { bestLocation: { ... } }
      setBestLocations([data.bestLocation]);
    } catch (error) {
      console.error("Error connecting to backend:", error);
    }
  };

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={["places"]}>
      <div style={{ display: "flex", height: "calc(100vh - 20px)", width: "calc(100vw - 20px)", gap: "20px", padding: "10px", boxSizing: "border-box", margin: "10px" }}>
        {/* LEFT CONTAINER (Inputs and Details) */}
        <div style={{ width: "50%", background: "#f8f9fa", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
          {/* Header */}
          <h1 style={{ fontSize: "28px", marginBottom: "20px", textAlign: "center", color: "#000", fontWeight: "bold" }}>Togather</h1>
  
          {/* Rows Container */}
          <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px" }}>
            {addresses.map((entry, index) => (
              <div key={index} style={{ display: "flex", alignItems: "center", gap: "50px", padding: "10px 0", borderBottom: "1px solid #ddd" }}>
                {/* Address Input (50% of row) */}
                <div style={{ flex: 1 }}>
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
                      style={{ width: "100%", padding: "10px", fontSize: "16px", borderRadius: "5px", border: "1px solid #ccc" }}
                    />
                  </Autocomplete>
                </div>
  
                {/* Dropdown (for transport) */}
                <div style={{ flex: 1 }}>
                  <select
                    value={entry.transport}
                    onChange={(e) => handleTransportChange(index, e.target.value)}
                    style={{ width: "100%", padding: "10px", fontSize: "16px", borderRadius: "5px", border: "1px solid #ccc" }}
                  >
                    <option value="driving">Car</option>
                    <option value="walking">Walking</option>
                    <option value="bicycling">Bicycle</option>
                    <option value="transit">Public Transport</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
  
          {/* Buttons Row */}
          <div style={{ display: "flex", gap: "50px" }}>
            <button
              onClick={handleAddAddress}
              disabled={addresses.length >= 10}
              style={{ flex: 1, padding: "10px", backgroundColor: "#6c757d", color: "#fff", border: "none", borderRadius: "5px", fontSize: "16px" }}
            >
              Add a new starting point
            </button>
            {addresses.length >= 2 && (
              <button
                onClick={handleCompute}
                style={{ flex: 1, padding: "10px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "5px", fontSize: "16px" }}
              >
                Find the best meeting point
              </button>
            )}
          </div>
  
          {/* Meeting Point Details */}
          {bestLocations.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                background: "#f0f0f0",
                color: "#333",
              }}
            >
              <h2>Best Meeting Point</h2>
              <p>
                <strong>{bestLocations[0].name || "Meeting Point"}</strong>
              </p>
              <p>{bestLocations[0].address || "Address not available"}</p>
              <p>
                Average travel time:{" "}
                {(bestLocations[0].averageTime / 60).toFixed(1)} min
              </p>
              <hr />
              <h3>Commute times:</h3>
              <ul>
                {addresses.map((entry, index) => (
                  <li key={index}>
                    {entry.address}:{" "}
                    {bestLocations[0].travelTimes[index] !== Infinity
                      ? (bestLocations[0].travelTimes[index] / 60).toFixed(1)
                      : "N/A"}{" "}
                    min (via {entry.transport})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
  
        {/* RIGHT CONTAINER (Map) */}
        <div style={{ width: "50%", height: "100%" }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={MAP_CENTER}
            zoom={12}
            options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
          >
            {markers.map((position, index) => (
              <Marker key={index} position={position} />
            ))}
  
            {/* Meeting Point Marker */}
            {bestLocations.length > 0 && (
              <Marker
                position={bestLocations[0].location}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                }}
                onClick={() => setMeetingInfoOpen(true)}
              />
            )}
  
            {/* InfoWindow for the meeting point */}
            {meetingInfoOpen && bestLocations.length > 0 && (
              <InfoWindow
                position={bestLocations[0].location}
                onCloseClick={() => setMeetingInfoOpen(false)}
              >
                <div style={{ background: "#f0f0f0", color: "#333", padding: "10px", borderRadius: "5px" }}>
                  <h3>{bestLocations[0].name || "Meeting Point"}</h3>
                  <p>{bestLocations[0].address || "Address not available"}</p>
                  <p>
                    Average travel time:{" "}
                    {(bestLocations[0].averageTime / 60).toFixed(1)} min
                  </p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </LoadScript>
  );
};

export default App;
