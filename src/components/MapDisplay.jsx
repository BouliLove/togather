import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

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

  const handleMapLoad = (map) => {
    try {
      if (!map || typeof map.getCenter !== 'function') {
        console.error('Map failed to initialize correctly');
        setMapError('Map initialization failed');
        return;
      }
      
      setMapInstance(map);
      console.log('Map instance loaded successfully');
    } catch (error) {
      console.error('Error loading map:', error);
      setMapError(`Map error: ${error.message}`);
    }
  };

  // Handle map load error
  const handleMapLoadError = (error) => {
    console.error('Map load error:', error);
    setMapError(`Failed to load map: ${error.message}`);
  };

  if (mapError) {
    return (
      <div className={`${className} map-error`}>
        <div className="map-error-message">
          <h3>Map Error</h3>
          <p>{mapError}</p>
        </div>
      </div>
    );
  }

  // Check if Google Maps is available before rendering
  if (!window.google || !window.google.maps) {
    return (
      <div className={`${className} map-loading`}>
        <div className="map-loading-message">Initializing map...</div>
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
      }}
      onLoad={handleMapLoad}
      onError={handleMapLoadError}
    >
      {/* Render all standard markers */}
      {markers && markers.map((position, index) => (
        <Marker key={`marker-${index}`} position={position} />
      ))}

      {/* Render the selected location with a special marker if provided */}
      {selectedLocation && selectedLocation.location && (
        <Marker
          position={selectedLocation.location}
          icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
          onClick={handleMarkerClick}
        />
      )}

      {/* Show info window for selected location if open */}
      {infoOpen && selectedLocation && selectedLocation.location && (
        <InfoWindow
          position={selectedLocation.location}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="info-window-content">
            <h3>{selectedLocation.name || "Meeting Point"}</h3>
            <p>{selectedLocation.address || "Address not available"}</p>
            {selectedLocation.averageTime && (
              <p>Average travel time: {(selectedLocation.averageTime / 60).toFixed(1)} min</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default MapDisplay;