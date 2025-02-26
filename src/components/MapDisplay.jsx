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
    setMapInstance(map);
  };

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
    >
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
    </GoogleMap>
  );
};

export default MapDisplay;