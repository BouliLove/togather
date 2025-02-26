import React, { useRef } from 'react';
import { Autocomplete } from '@react-google-maps/api';

// Define Paris region bounds for Autocomplete
const ILE_DE_FRANCE_BOUNDS = {
  north: 49.1,
  south: 48.0,
  west: 1.5,
  east: 3.5,
};

const AddressInputs = ({ 
  addresses, 
  mapsLoaded,
  onAddressChange, 
  onTransportChange, 
  onPlaceSelect,
  onRemoveAddress
}) => {
  const autocompleteRefs = useRef([]);

  const handleLoad = (autocomplete, index) => {
    if (autocomplete) {
      autocompleteRefs.current[index] = autocomplete;
    }
  };

  const handlePlaceChanged = (index) => {
    try {
      if (autocompleteRefs.current[index]) {
        const place = autocompleteRefs.current[index].getPlace();
        if (place && place.geometry && place.geometry.location) {
          onPlaceSelect(place, index);
        }
      }
    } catch (error) {
      console.error('Error in place selection:', error);
    }
  };

  // Create bounds object for the autocomplete options
  const createBounds = () => {
    try {
      if (window.google && window.google.maps) {
        return new window.google.maps.LatLngBounds(
          { lat: ILE_DE_FRANCE_BOUNDS.south, lng: ILE_DE_FRANCE_BOUNDS.west },
          { lat: ILE_DE_FRANCE_BOUNDS.north, lng: ILE_DE_FRANCE_BOUNDS.east }
        );
      }
      return undefined;
    } catch (error) {
      console.error('Error creating bounds:', error);
      return undefined;
    }
  };

  return (
    <div className="address-rows">
      {addresses.map((entry, index) => (
        <div key={index} className="address-row">
          <div className="address-input-group">
            <div className="address-input">
              {mapsLoaded ? (
                <Autocomplete
                  onLoad={(autocomplete) => handleLoad(autocomplete, index)}
                  onPlaceChanged={() => handlePlaceChanged(index)}
                  options={{
                    bounds: createBounds(),
                    strictBounds: true,
                    componentRestrictions: { country: "FR" },
                  }}
                >
                  <input
                    type="text"
                    placeholder={`Address ${index + 1}`}
                    value={entry.address}
                    onChange={(e) => onAddressChange(index, e.target.value)}
                    className="address-input-field"
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  placeholder={`Address ${index + 1}`}
                  value={entry.address}
                  onChange={(e) => onAddressChange(index, e.target.value)}
                  className="address-input-field"
                />
              )}
            </div>
            <div className="transport-select">
              <select
                value={entry.transport}
                onChange={(e) => onTransportChange(index, e.target.value)}
                className="transport-select-field"
              >
                <option value="driving">Car</option>
                <option value="walking">Walking</option>
                <option value="bicycling">Bicycle</option>
                <option value="transit">Transit</option>
              </select>
            </div>
            {addresses.length > 1 && (
              <button 
                onClick={() => onRemoveAddress(index)} 
                className="remove-address-btn"
                aria-label="Remove address"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AddressInputs;