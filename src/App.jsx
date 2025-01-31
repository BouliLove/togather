import React, { useState, useRef } from "react";
import { LoadScript, Autocomplete, GoogleMap, Marker } from "@react-google-maps/api";

const ILE_DE_FRANCE_BOUNDS = {
  north: 49.1, 
  south: 48.0, 
  west: 1.5,  
  east: 3.5,  
};

const MAP_CENTER = { lat: 48.8566, lng: 2.3522 }; // Default: Paris center

// Dark Theme - No Labels, No Icons
const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] }, // Remove icons
  { featureType: "transit", stylers: [{ visibility: "off" }] }, // Hide transit lines
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#373737" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d47a1" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] }
];

const App = () => {
  const [addresses, setAddresses] = useState([]);
  const [markers, setMarkers] = useState([]);
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

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={["places"]}>
      <div style={{
        display: "flex",
        height: "calc(100vh - 20px)", // Leaves a 1cm margin
        width: "calc(100vw - 20px)", // Leaves a 1cm margin
        gap: "20px",
        padding: "10px",
        boxSizing: "border-box",
        margin: "10px",
      }}>
        {/* Left Section - Inputs */}
        <div style={{
          width: "600px", 
          background: "#f8f9fa",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center", // Centers the content horizontally
          textAlign: "center"
        }}>
          <h1 style={{ fontSize: "28px", marginBottom: "20px", color: "#000", fontWeight: "bold" }}>Togather</h1> {/* Increased size */}
          {addresses.map((entry, index) => (
            <div key={index} style={{ marginBottom: "10px", display: "flex", gap: "10px", padding: "5px" }}>
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
                  style={{ width: "350px", padding: "10px", fontSize: "16px", borderRadius: "5px" }}
                />
              </Autocomplete>
              <select
                value={entry.transport}
                onChange={(e) => handleTransportChange(index, e.target.value)}
                style={{ padding: "10px", fontSize: "16px", borderRadius: "5px", width: "200px" }}
              >
                <option value="driving">Car</option>
                <option value="walking">Walking</option>
                <option value="bicycling">Bicycle</option>
                <option value="transit">Public Transport</option>
              </select>
            </div>
          ))}
          <button onClick={handleAddAddress} disabled={addresses.length >= 10} style={{ width: "100%", padding: "10px", marginBottom: "10px" }}>
            Add Address
          </button>
          {addresses.length >= 2 && (
            <button style={{ width: "100%", padding: "10px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "5px" }}>
              Compute Best Location
            </button>
          )}
        </div>

        {/* Right Section - Map */}
        <div style={{
          flexGrow: 1,
          height: "100%",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)"
        }}>
          <GoogleMap 
            mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "10px" }} 
            center={MAP_CENTER} 
            zoom={12}
            options={{ 
              styles: MAP_STYLES, 
              disableDefaultUI: true, // Removes all controls including Map/Satellite switch and Street View
              zoomControl: true // Keeps zoom control
            }} 
          >
            {markers.map((position, index) => (
              <Marker key={index} position={position} />
            ))}
          </GoogleMap>
        </div>
      </div>
    </LoadScript>
  );
};

export default App;
