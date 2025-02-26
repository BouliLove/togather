import React, { useState, useCallback } from 'react';
import { LoadScript, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const MapContainer = ({ 
  apiKey, 
  center = { lat: 48.8566, lng: 2.3522 }, // Paris by default
  zoom = 12,
  markers = [],
  selectedLocation = null,
  mapStyles = [],
  className = "google-map",
  disableDefaultUI = false,
  zoomControl = true,
  onError = () => {},
  showInfoWindow = false,
  onInfoWindowClose = () => {},
  onMarkerClick = () => {}
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [infoOpen, setInfoOpen] = useState(showInfoWindow);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    console.log('Google Maps loaded successfully');
  }, []);

  const handleError = useCallback((error) => {
    setLoadError(`Failed to load Google Maps: ${error}`);
    console.error('Google Maps loading error:', error);
    onError(error);
  }, [onError]);

  // Update infoOpen when showInfoWindow prop changes
  React.useEffect(() => {
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

  // If no API key, show a placeholder
  if (!apiKey) {
    return (
      <div className={`${className} map-placeholder`}>
        <div className="map-error-message">
          <h3>Map Unavailable</h3>
          <p>Google Maps API key is missing.</p>
        </div>
      </div>
    );
  }

  // If there was a load error, show error message
  if (loadError) {
    return (
      <div className={`${className} map-error`}>
        <div className="map-error-message">
          <h3>Map Loading Error</h3>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      onLoad={handleLoad}
      onError={handleError}
      loadingElement={
        <div className={`${className} map-loading`}>
          <div className="map-loading-message">Loading map...</div>
        </div>
      }
    >
      <GoogleMap
        mapContainerClassName={className}
        center={center}
        zoom={zoom}
        options={{
          styles: mapStyles,
          disableDefaultUI,
          zoomControl,
        }}
      >
        {/* Only render children when the map is loaded to prevent errors */}
        {isLoaded && (
          <>
            {/* Render all standard markers */}
            {markers.map((position, index) => (
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
          </>
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default MapContainer;