import React, { useState, useRef, useEffect } from "react";
import { LoadScript } from "@react-google-maps/api";
import MapDisplay from "./components/MapDisplay";
import { MapPin, X, Bike, Car, Train, Footprints, Plus, Loader, Share2, Search, ChevronUp, ChevronDown } from 'lucide-react';

// Constants
const MAP_CENTER = { lat: 48.8566, lng: 2.3522 }; // Paris
const MAP_STYLES = [
  {
    "featureType": "all",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "weight": "2.00"
      }
    ]
  },
  // Other style elements remain the same
];

const TravelModes = {
  WALKING: { icon: <Footprints size={20} />, label: "Walking" },
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
    { id: 1, address: "", transport: "WALKING", color: COLORS[0] },
    { id: 2, address: "", transport: "WALKING", color: COLORS[1] }
  ]);
  const [markers, setMarkers] = useState([]);
  const [bestLocations, setBestLocations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" or "map"
  const [venueType, setVenueType] = useState("");
  const [error, setError] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(null);
  const [mapsLoadTimeout, setMapsLoadTimeout] = useState(false);
  const bottomSheetRef = useRef(null);
  const addressInputRef = useRef(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [mapHeight, setMapHeight] = useState("40vh"); // Default map height

  // Monitor Google Maps loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!mapsLoaded && !mapsLoadError) {
        setMapsLoadTimeout(true);
        console.warn("Google Maps loading timed out - possibly blocked by an ad blocker");
      }
    }, 5000); // 5 seconds timeout
    
    return () => clearTimeout(timeoutId);
  }, [mapsLoaded, mapsLoadError]);

  // Handle adding a new address row
  const handleAddAddress = () => {
    if (locations.length < 10) {
      setLocations([...locations, { 
        id: Date.now(), 
        address: '', 
        transport: 'WALKING',
        color: COLORS[locations.length % COLORS.length]
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
      
      // If maps are loaded, switch to map view
      if (mapsLoaded) {
        setViewMode("map");
      }
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
  };
  
  // Toggle map height for mobile view
  const toggleMapHeight = () => {
    setMapHeight(mapHeight === "40vh" ? "70vh" : "40vh");
  };

  // Google Maps loading handlers
  const handleMapsLoad = () => {
    console.log("Google Maps API loaded successfully");
    setMapsLoaded(true);
    setMapsLoadTimeout(false);
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
      <div className="min-h-screen bg-white text-gray-800">
        <header className="bg-blue-600 text-white py-4 px-6 flex justify-center items-center">
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
    <div className="flex flex-col min-h-screen bg-white text-gray-800">
      {/* Header */}
      <header className="bg-blue-600 text-white py-4 px-6 flex justify-between items-center z-10 shadow-md">
        <h1 className="text-2xl font-bold">Togather</h1>
        {(markers.length > 0 || bestLocations.length > 0) && mapsLoaded && (
          <button 
            onClick={toggleView} 
            className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium shadow-sm hover:bg-blue-50 transition-colors"
          >
            {viewMode === "form" ? "View Map" : "Back to Form"}
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex flex-col flex-grow">
        <LoadScript
          googleMapsApiKey={googleMapsApiKey}
          libraries={["places"]}
          onLoad={handleMapsLoad}
          onError={handleMapsError}
          loadingElement={
            <div className="flex-grow flex items-center justify-center bg-blue-50">
              <div className="flex flex-col items-center">
                <Loader className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-blue-700 font-medium">Loading Google Maps...</p>
              </div>
            </div>
          }
        >
          {/* Map Section */}
          {viewMode === "map" && mapsLoaded ? (
            <div className="flex-grow relative">
              <MapDisplay
                center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                zoom={markers.length > 0 ? 11 : 10}
                markers={markers}
                selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
                mapStyles={MAP_STYLES}
                className="w-full h-full"
                disableDefaultUI={false}
                zoomControl={true}
              />
              <button
                onClick={toggleView}
                className="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md font-medium shadow-lg hover:bg-blue-700"
              >
                Back to Form
              </button>
            </div>
          ) : (
            <div className="flex flex-col flex-grow">
              {/* Map Preview - Shows even if in form mode */}
              <div 
                className="w-full relative transition-all duration-300 ease-in-out"
                style={{ height: mapHeight }}
              >
                {mapsLoaded ? (
                  <MapDisplay
                    center={markers.length > 0 ? markers[markers.length - 1] : MAP_CENTER}
                    zoom={markers.length > 0 ? 11 : 10}
                    markers={markers}
                    selectedLocation={bestLocations.length > 0 ? bestLocations[0] : null}
                    mapStyles={MAP_STYLES}
                    className="w-full h-full"
                    disableDefaultUI={false}
                    zoomControl={true}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    {mapsLoadTimeout ? (
                      <div className="text-center p-4 max-w-md">
                        <p className="text-red-600 font-medium mb-2">
                          Google Maps cannot be loaded.
                        </p>
                        <p className="text-gray-700 text-sm">
                          This may be caused by an ad blocker. Please disable it and refresh the page.
                        </p>
                      </div>
                    ) : (
                      <Loader className="animate-spin text-blue-600" size={40} />
                    )}
                  </div>
                )}
                
                {/* Toggle map height button */}
                <button 
                  onClick={toggleMapHeight}
                  className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md z-20 hover:bg-gray-100 transition-colors"
                >
                  {mapHeight === "40vh" ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {/* Form */}
              <div className="flex-grow bg-white p-6 overflow-y-auto">
                {/* Venue Type Input */}
                <div className="mb-6">
                  <label htmlFor="venue-type" className="text-gray-700 text-sm font-medium mb-2 block">
                    What kind of place to meet at?
                  </label>
                  <div className="relative">
                    <input
                      id="venue-type"
                      type="text" 
                      placeholder="e.g., restaurant, cinema, cafe, park..." 
                      value={venueType}
                      onChange={handleVenueTypeChange}
                      className="w-full bg-gray-100 text-gray-800 px-4 py-3 pl-11 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white border border-gray-200"
                    />
                    <MapPin className="absolute left-3 top-3.5 text-blue-500" size={20} />
                  </div>
                </div>
                
                {/* Error message if any */}
                {(error || mapsLoadError) && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
                    {error || mapsLoadError}
                  </div>
                )}
                
                {/* Starting Points Heading */}
                <h2 className="text-gray-800 text-xl font-bold mb-4">Starting Points</h2>
                
                {/* Address inputs */}
                <div className="space-y-4 mb-6">
                  {locations.map((location, index) => (
                    <div key={location.id} className="relative">
                      <div 
                        className="flex items-center bg-gray-100 rounded-lg overflow-hidden border-l-4 shadow-sm hover:shadow transition-shadow"
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
                            className="w-full bg-gray-100 text-gray-800 px-4 py-3 pl-11 focus:outline-none focus:bg-white"
                            placeholder="Enter address..."
                            ref={index === focusedInput ? addressInputRef : null}
                          />
                          <Search className="absolute top-3.5 left-3 text-blue-500" size={18} />
                        </div>
                        
                        <button
                          className="p-3 text-gray-600 hover:bg-gray-200 transition-colors"
                          onClick={() => handleToggleTravelMode(location.id)}
                          title={TravelModes[location.transport]?.label || "Travel mode"}
                        >
                          {TravelModes[location.transport]?.icon || <Car size={20} />}
                        </button>
                        
                        {locations.length > 2 && (
                          <button
                            className="p-3 text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => handleRemoveAddress(location.id)}
                            title="Remove location"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>

                      {/* Address suggestions */}
                      {suggestions && 
                      suggestions.locationIndex === index && 
                      suggestions.items.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
                          {suggestions.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="px-4 py-2 text-gray-700 hover:bg-blue-50 cursor-pointer"
                              onClick={() => selectSuggestion(item, index)}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {locations.length < 10 && (
                    <button
                      onClick={handleAddAddress}
                      className="bg-gray-100 text-gray-700 py-3 rounded-lg flex items-center justify-center space-x-2 border border-gray-300 hover:bg-gray-200 transition-colors"
                    >
                      <Plus size={20} />
                      <span>Add start point</span>
                    </button>
                  )}
                  
                  <button
                    onClick={handleFindMeetingPoint}
                    disabled={isCalculating}
                    className={`${locations.length < 10 ? 'col-span-1' : 'col-span-2'} bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:hover:bg-blue-600`}
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
                  <div className="mt-6 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-md">
                    <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                      <h3 className="text-lg font-bold">Best Meeting Point</h3>
                      <div className="bg-blue-500 px-3 py-1 rounded-full text-sm font-bold">
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
                              <div key={index} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50">
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
                      
                      <button className="mt-4 w-full flex items-center justify-center bg-blue-600 text-white py-3 rounded-lg shadow hover:bg-blue-700 transition-colors">
                        <Share2 size={18} className="mr-2" />
                        Share Meeting Point
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </LoadScript>
      </div>
    </div>
  );
};

export default App;