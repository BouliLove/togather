import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

// Colors for markers - defined at component level to ensure availability
const COLORS = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];

const MapDisplay = ({ 
  center = { lat: 48.8566, lng: 2.3522 }, // Paris by default
  zoom = 12,
  markers = [],
  selectedLocation = null,
  mapStyles = [],
  className = "google-map",
  disableDefaultUI = false,
  zoomControl = true,
  showInfoWindow = false,
  onInfoWindowClose = () => {},
  onMarkerClick = () => {}
}) => {
  const [infoOpen, setInfoOpen] = useState(showInfoWindow);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapError, setMapError] = useState(null);

  // Update infoOpen when showInfoWindow prop changes
  useEffect(() => {
    setInfoOpen(showInfoWindow);
  }, [showInfoWindow]);

  const handleInfoWindowClose = () => {
    setInfoOpen(false);
    onInfoWindowClose();
  };

  const handleMarkerClick = () => {
    setInfoOpen(true);
    onMarkerClick();
  };

  const handleMapLoad = useCallback((map) => {
    try {
      if (!map || typeof map.getCenter !== 'function') {
        console.error('Map failed to initialize correctly');
        setMapError('Map initialization failed');
        return;
      }
      
      setMapInstance(map);
      console.log('Map instance loaded successfully');
      
      // Force a resize event to ensure the map renders properly
      window.google.maps.event.trigger(map, 'resize');
    } catch (error) {
      console.error('Error loading map:', error);
      setMapError(`Map error: ${error.message}`);
    }
  }, []);

  // Ensure map is resized on window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstance) {
        window.google.maps.event.trigger(mapInstance, 'resize');
        if (center) {
          mapInstance.setCenter(center);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapInstance, center]);

  // Handle map load error
  const handleMapLoadError = (error) => {
    console.error('Map load error:', error);
    setMapError(`Failed to load map: ${error.message}`);
  };

  if (mapError) {
    return (
      <div className={`${className} bg-blue-50 flex items-center justify-center`}>
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-4">
          <h3 className="text-xl font-semibold text-red-600 mb-2">Map Error</h3>
          <p className="text-gray-700">{mapError}</p>
          <button 
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md"
            onClick={() => setMapError(null)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if Google Maps is available before rendering
  if (!window.google || !window.google.maps) {
    return (
      <div className={`${className} bg-blue-50 flex items-center justify-center`}>
        <div className="text-center p-4">
          <div className="inline-block border-4 border-blue-400 border-t-blue-600 rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p className="text-blue-700 font-medium">Initializing map...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName={className}
      center={center}
      zoom={zoom}
      options={{
        styles: mapStyles,
        disableDefaultUI,
        zoomControl,
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU
        }
      }}
      onLoad={handleMapLoad}
      onError={handleMapLoadError}
    >
      {/* Render all standard markers */}
      {markers && markers.map((position, index) => (
        <Marker 
          key={`marker-${index}`} 
          position={position}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: COLORS[index % COLORS.length],
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF'
          }}
        />
      ))}

      {/* Render the selected location with a special marker if provided */}
      {selectedLocation && selectedLocation.location && (
        <Marker
          position={selectedLocation.location}
          icon={{
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new window.google.maps.Size(36, 36)
          }}
          onClick={handleMarkerClick}
          animation={window.google.maps.Animation.DROP}
        />
      )}

      {/* Show info window for selected location if open */}
      {infoOpen && selectedLocation && selectedLocation.location && (
        <InfoWindow
          position={selectedLocation.location}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-base mb-1">{selectedLocation.name || "Meeting Point"}</h3>
            <p className="text-sm text-gray-700 mb-2">{selectedLocation.address || "Address not available"}</p>
            {selectedLocation.averageTime && (
              <p className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                Average travel time: {(selectedLocation.averageTime / 60).toFixed(1)} min
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default MapDisplay;