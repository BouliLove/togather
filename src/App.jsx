import React, { useState, useRef, useEffect } from "react";
import { LoadScript } from "@react-google-maps/api";
import MapDisplay from "./components/MapDisplay";
import AddressInputs from "./components/AddressInputs";
import { MapPin, X, Bike, Car, Train, Navigation, Plus, Loader, Share2, ArrowUpDown, Search, ChevronUp, ChevronDown } from 'lucide-react';

// Constants
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

const TravelModes = {
  WALKING: { icon: <Navigation size={20} />, label: "Walking" },
  BICYCLING: { icon: <Bike size={20} />, label: "Bicycling" },
  TRANSIT: { icon: <Train size={20} />, label: "Transit" },
  DRIVING: { icon: <Car size={20} />, label: "Driving" }
};

const COLORS = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];

const App = () => {
  // Get environment variables
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
  
  // State management
  const [locations, setLocations] = useState([
    { id: 1, address: "", transport: "transit", color: COLORS[0] },
    { id: 2, address: "", transport: "transit", color: COLORS[1] }
  ]);
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" or "map"
  const [mapExpanded, setMapExpanded] = useState(false);
  const [venueType, setVenueType] = useState("");
  const [error, setError] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(null);
  const [bottomSheetHeight, setBottomSheetHeight] = useState("min");
  const bottomSheetRef = useRef(null);
  const addressInputRef = useRef(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [suggestions, setSuggestions] = useState(null);

  // Handle adding a new address row
  const handleAddAddress = () => {
    if (locations.length < 4) {
      setLocations([...locations, { 
        id: Date.now(), 
        address: '', 
        transport: 'WALKING',
        color: COLORS[locations.length]
      }]);
    }
  };

  // Handle removing an address row
  const handleRemoveAddress = (id) => {
    if (locations.length > 2) {
      setLocations(locations.filter(loc => loc.id !== id));
    }
  };

  // Handle updating address values
  const handleAddressChange = (id, value) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, address: value } : loc
    ));
  };

  // Handle updating transport mode
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
        const id = locations[index].id;
        handleAddressChange(id, place.formatted_address || "");
        
        // Update markers
        const newMarkers = [...markers];
        newMarkers[index] = { lat, lng };
        setMarkers(newMarkers);
      }
    } catch (error) {
      console.error("Error handling place selection:", error);
    }
  };

  // Swap locations
  const swapLocations = (index1, index2) => {
    if (index1 >= 0 && index2 >= 0 && index1 < locations.length && index2 < locations.length) {
      const newLocations = [...locations];
      [newLocations[index1], newLocations[index2]] = [newLocations[index2], newLocations[index1]];
      setLocations(newLocations);
    }
  };

  // Handle compute button click - calculate best meeting point
  const handleFindMeetingPoint = async () => {
    // Validate we have at least 2 addresses
    const validAddresses = locations.filter(a => a.address.trim() !== "");
    if (validAddresses.length < 2) {
      setError("Please enter at least two valid addresses");
      return;
    }

    setIsCalculating(true);
    setError(null);
    
    try {
      console.log("Sending request to:", backendUrl);
      const response = await fetch(`${backendUrl}/compute-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          locations: locations.map(l => ({
            address: l.address,
            transport: l.transport.toLowerCase()
          })),
          venueType: venueType.trim()
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
      setBottomSheetHeight("results");
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setError("Connection error. Please check your internet connection.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle map/form view toggling
  const toggleView = () => {
    setViewMode(viewMode === "form" ? "map" : "form");
    setMapExpanded(false);
  };
  
  // Handle mini-map expansion on mobile
  const toggleMapExpanded = () => {
    setIsMapExpanded(!isMapExpanded);
  };
  
  // Bottom sheet control
  const toggleBottomSheet = () => {
    if (bottomSheetHeight === "min") {
      setBottomSheetHeight("expanded");
    } else {
      setBottomSheetHeight("min");
    }
  };
  
  const getBottomSheetStyle = () => {
    if (bottomSheetHeight === "min") {
      return "h-52";
    } else if (bottomSheetHeight === "expanded") {
      return "h-4/6";
    } else if (bottomSheetHeight === "results") {
      return "h-3/5";
    }
    return "h-52";
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

  // Simulated address autocomplete
  const simulateAddressSuggestions = (input, index) => {
    if (input.length > 3) {
      setSuggestions({
        locationIndex: index,
        items: [
          input + ", Paris, France",
          input + " Avenue, Paris, France",
          input + " Boulevard, Paris, France"
        ]
      });
    } else {
      setSuggestions(null);
    }
  };

  const selectSuggestion = (suggestion, index) => {
    handleAddressChange(locations[index].id, suggestion);
    setSuggestions(null);
  };

  // If there's no Google Maps API key, show an error
  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-screen bg-gray-100 flex flex-col">
        <header className="bg-blue-500 text-white py-4 px-6 flex justify-center items-center z-10">
          <h1 className="text-2xl font-bold">Togather</h1>
        </header>
        <div className="p-8 mx-auto max-w-xl text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-gray-700">Google Maps API key is missing. Please check your environment configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-500 text-white py-4 px-6 flex justify-between items-center z-10">
        <h1 className="text-2xl font-bold">Togather</h1>
        {(markers.length > 0 || bestLocations.length > 0) && (
          <button 
            onClick={toggleView} 
            className="bg-white text-blue-500 px-4 py-2 rounded-md font-medium"
          >
            {viewMode === "form" ? "View Map" : "Back to Form"}
          </button>
        )}
      </header>

      {/* Main App Container */}
      <LoadScript
        googleMapsApiKey={googleMapsApiKey}
        libraries={["places"]}
        onLoad={handleMapsLoad}
        onError={handleMapsError}
        loadingElement={
          <div className="h-full flex items-center justify-center">
            <p>Loading Google Maps...</p>
          </div>
        }
      >
        <div className={`relative ${isMapExpanded ? 'h-5/6' : 'h-3/5'} w-full transition-all duration-300`}>
          {/* Mini Map */}
          <div className="w-full h-full bg-gray-800 relative overflow-hidden">
            {mapsLoaded && (
              <MapDisplay
                center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                zoom={markers.length > 0 ? 11 : 10}
                markers={markers}
                selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
                mapStyles={MAP_STYLES}
                className="w-full h-full object-cover"
                disableDefaultUI={true}
                zoomControl={false}
              />
            )}
            
            {/* Map control buttons */}
            <button 
              onClick={toggleMapExpanded}
              className="absolute top-3 right-3 bg-white p-2 rounded-md shadow-md z-20"
            >
              {isMapExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </div>
          
        {/* Bottom Sheet */}
        <div 
          ref={bottomSheetRef}
          className={`absolute bottom-0 w-full bg-gray-900 rounded-t-xl shadow-lg transform transition-all duration-300 ease-in-out overflow-hidden z-30 ${getBottomSheetStyle()}`}
        >
          {/* Handle for dragging */}
          <div 
            className="w-full flex justify-center pt-2 pb-4 cursor-pointer"
            onClick={toggleBottomSheet}
          >
            <div className="w-10 h-1 bg-gray-500 rounded-full"></div>
          </div>

          <div className="px-4 pb-20 overflow-y-auto max-h-full">
            {/* Venue Type Input */}
            <div className="mb-4">
              <label htmlFor="venue-type" className="text-white text-sm font-medium mb-1 block">
                What kind of place to meet at?
              </label>
              <input
                id="venue-type"
                type="text" 
                placeholder="e.g., restaurant, cinema, cafe, park..." 
                value={venueType}
                onChange={handleVenueTypeChange}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Error message if any */}
            {(error || mapsLoadError) && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
                {error || mapsLoadError}
              </div>
            )}
            
            {/* Starting Points Heading */}
            <h2 className="text-white text-xl font-bold mb-4">Starting Points</h2>
            
            {/* Address inputs */}
            <div className="space-y-3 mb-4">
              {locations.map((location, index) => (
                <div key={location.id} className="relative">
                  <div 
                    className="flex items-center bg-gray-800 rounded-lg overflow-hidden border-l-4 shadow-md"
                    style={{ borderLeftColor: location.color }}
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={location.address}
                        onChange={(e) => {
                          handleAddressChange(location.id, e.target.value);
                          simulateAddressSuggestions(e.target.value, index);
                        }}
                        onFocus={() => setFocusedInput(index)}
                        className="w-full bg-gray-800 text-white px-4 py-3 focus:outline-none"
                        placeholder="Enter address..."
                        ref={index === focusedInput ? addressInputRef : null}
                      />
                      <Search className="absolute top-3 left-2 text-gray-400" size={18} />
                    </div>
                    
                    <button
                      className="p-3 text-white bg-gray-700 hover:bg-gray-600"
                      onClick={() => handleToggleTravelMode(location.id)}
                    >
                      {TravelModes[location.transport]?.icon || <Car size={20} />}
                    </button>
                    
                    {locations.length > 2 && (
                      <button
                        className="p-3 text-white bg-red-500 hover:bg-red-600"
                        onClick={() => handleRemoveAddress(location.id)}
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  {/* Address suggestions */}
                  {suggestions && 
                   suggestions.locationIndex === index && 
                   suggestions.items.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white rounded-md shadow-lg">
                      {suggestions.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                          onClick={() => selectSuggestion(item, index)}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Swap button */}
                  {index < locations.length - 1 && (
                    <button 
                      className="absolute -right-10 top-1/2 transform -translate-y-1/2 bg-gray-700 p-1 rounded-full text-white"
                      onClick={() => swapLocations(index, index + 1)}
                    >
                      <ArrowUpDown size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3 mb-6">
              {locations.length < 4 && (
                <button
                  onClick={handleAddAddress}
                  className="w-full bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center space-x-2 border border-gray-700"
                >
                  <Plus size={20} />
                  <span>Add start point</span>
                </button>
              )}
              
              <button
                onClick={handleFindMeetingPoint}
                disabled={isCalculating}
                className="w-full bg-blue-500 text-white py-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-70"
              >
                {isCalculating ? (
                  <>
                    <Loader className="animate-spin mr-2" size={20} />
                    <span>Finding best spot...</span>
                  </>
                ) : (
                  <span>Find best meeting point</span>
                )}
              </button>
            </div>
            
            {/* Results section */}
            {bestLocations.length > 0 && bestLocations[0] && (
              <div className="mt-4 bg-white rounded-lg overflow-hidden">
                <div className="bg-blue-500 text-white p-4 flex justify-between items-center">
                  <h3 className="text-lg font-bold">Best Meeting Point</h3>
                  <div className="bg-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                    {(bestLocations[0].averageTime / 60).toFixed(1)} min
                  </div>
                </div>
                
                <div className="p-4">
                  <h4 className="text-xl font-bold text-gray-800">{bestLocations[0].name}</h4>
                  <p className="text-gray-600">{bestLocations[0].address}</p>
                
                  {bestLocations[0].rating && (
                    <div className="mt-2 flex items-center">
                      <span className="text-yellow-500 mr-1">
                        {"★".repeat(Math.round(bestLocations[0].rating))}
                        {"☆".repeat(5 - Math.round(bestLocations[0].rating))}
                      </span>
                      <span className="font-bold">{bestLocations[0].rating}</span>
                      {bestLocations[0].userRatingsTotal && (
                        <span className="text-sm text-gray-500 ml-1">({bestLocations[0].userRatingsTotal})</span>
                      )}
                    </div>
                  )}
                
                  <div className="mt-4">
                    <h5 className="text-gray-700 font-medium mb-2">Commute times:</h5>
                    <div className="space-y-3">
                      {locations.map((entry, index) => {
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
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div 
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-gray-800">{displayAddress}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="font-bold">{formattedTime} min</span>
                              <span className="text-sm text-gray-500">({TravelModes[entry.transport]?.label})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <button className="mt-4 w-full flex items-center justify-center bg-blue-500 text-white py-3 rounded-lg">
                    <Share2 size={18} className="mr-2" />
                    Share Meeting Point
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </LoadScript>
    </div>
  );
};

export default App;