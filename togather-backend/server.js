// Load environment variables
require("dotenv").config({ path: "./.env" });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
console.log("Loaded Google Maps API Key:", GOOGLE_MAPS_API_KEY);

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// Use a permissive CORS policy for testing
app.use(cors());
app.options("*", cors());

app.use(express.json());

// Geocode an address and return its latitude/longitude.
const geocodeAddress = async (address) => {
  try {
    console.log("Geocoding address:", address);
    const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { address, key: GOOGLE_MAPS_API_KEY },
    });
    const location = response.data.results[0]?.geometry?.location;
    return location ? { lat: location.lat, lng: location.lng } : null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
};

// Compute the weighted geographic epicenter of an array of addresses.
// This gives slightly more weight to addresses that are further from the others.
const computeWeightedEpicenter = async (locations) => {
  const geocodedLocations = [];
  
  // First geocode all addresses to get coordinates
  for (const location of locations) {
    const coords = await geocodeAddress(location.address);
    if (coords) {
      geocodedLocations.push({
        ...coords,
        transport: location.transport,
        address: location.address
      });
    }
  }
  
  if (geocodedLocations.length === 0) return null;
  if (geocodedLocations.length === 1) return geocodedLocations[0];
  
  // Calculate distances between all points
  const distances = {};
  for (let i = 0; i < geocodedLocations.length; i++) {
    const locA = geocodedLocations[i];
    distances[i] = 0;
    
    for (let j = 0; j < geocodedLocations.length; j++) {
      if (i === j) continue;
      const locB = geocodedLocations[j];
      
      // Haversine distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = (locB.lat - locA.lat) * Math.PI / 180;
      const dLon = (locB.lng - locA.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(locA.lat * Math.PI / 180) * Math.cos(locB.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      distances[i] += distance;
    }
  }
  
  // Find total distance sum and calculate weights
  const totalDistance = Object.values(distances).reduce((sum, dist) => sum + dist, 0);
  const weights = {};
  
  for (let i = 0; i < geocodedLocations.length; i++) {
    // Locations further from others get slightly more weight
    // We use a moderate weighting factor to avoid overcompensating
    weights[i] = 0.4 + (0.6 * distances[i] / totalDistance);
  }
  
  // Apply weights to calculate the epicenter
  let weightedLatSum = 0;
  let weightedLngSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < geocodedLocations.length; i++) {
    const location = geocodedLocations[i];
    
    // Apply transport mode factor - give less weight to fast transport methods
    let transportFactor = 1.0;
    switch (location.transport) {
      case 'driving': transportFactor = 0.7; break;  // Cars can travel further easily
      case 'transit': transportFactor = 0.85; break; // Public transit is less flexible than cars
      case 'bicycling': transportFactor = 1.1; break; // Bikes need more consideration
      case 'walking': transportFactor = 1.3; break;   // Walking needs the most consideration
      default: transportFactor = 1.0;
    }
    
    const finalWeight = weights[i] * transportFactor;
    weightedLatSum += location.lat * finalWeight;
    weightedLngSum += location.lng * finalWeight;
    weightSum += finalWeight;
  }
  
  return { 
    lat: weightedLatSum / weightSum, 
    lng: weightedLngSum / weightSum,
    originalLocations: geocodedLocations
  };
};

// Get travel time for one origin to a given destination using a specified transport mode.
const getTravelTimeForOrigin = async (origin, destination, mode) => {
  try {
    const response = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
      params: { 
        origins: origin, 
        destinations: destination, 
        mode, 
        key: GOOGLE_MAPS_API_KEY,
        // Add departure_time for transit and traffic model for driving
        ...(mode === 'transit' && { departure_time: 'now' }),
        ...(mode === 'driving' && { 
          departure_time: 'now',
          traffic_model: 'best_guess'
        })
      },
    });
    
    // Get both duration and distance
    const element = response.data.rows[0].elements[0];
    const duration = element.duration?.value || Infinity;
    const distance = element.distance?.value || Infinity; // in meters
    
    return { duration, distance };
  } catch (error) {
    console.error("Error fetching travel time for", origin, destination, mode, error);
    return { duration: Infinity, distance: Infinity };
  }
};

// Lookup a venue using search parameters
const searchVenues = async (location, options) => {
  const { keyword, type, radius = 1000, rankBy = 'prominence', minRating = 0, openNow = false, maxResults = 5 } = options;
  
  try {
    const params = {
      location: `${location.lat},${location.lng}`,
      key: GOOGLE_MAPS_API_KEY,
      ...(radius && rankBy !== 'distance' ? { radius } : {}),
      ...(rankBy === 'distance' ? { rankby: 'distance' } : {}),
      ...(keyword ? { keyword } : {}),
      ...(type ? { type } : {}),
      ...(openNow ? { opennow: true } : {}),
      // fields to return
      fields: 'formatted_address,name,rating,opening_hours,geometry,price_level,user_ratings_total,vicinity,place_id',
    };
    
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", { params });
    
    if (response.data.results && response.data.results.length > 0) {
      // Filter by rating if specified
      let filteredResults = response.data.results;
      if (minRating > 0) {
        filteredResults = filteredResults.filter(place => place.rating >= minRating);
      }
      
      // Sort by a combination of prominence and distance
      filteredResults.sort((a, b) => {
        // Calculate distance from the epicenter
        const distA = calculateDistance(
          location.lat, location.lng,
          a.geometry.location.lat, a.geometry.location.lng
        );
        
        const distB = calculateDistance(
          location.lat, location.lng,
          b.geometry.location.lat, b.geometry.location.lng
        );
        
        // Balance between rating and distance
        // Places with better ratings can be a bit further away
        // Default to 0 if rating doesn't exist
        const scoreA = (a.rating || 3.0) * 100 - distA;
        const scoreB = (b.rating || 3.0) * 100 - distB;
        
        return scoreB - scoreA;
      });
      
      return filteredResults.slice(0, maxResults);
    }
    return [];
  } catch (error) {
    console.error("Error looking up venues:", error);
    return [];
  }
};

// Calculate straight-line distance between two sets of coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // distance in meters
}

app.post("/compute-location", async (req, res) => {
  try {
    const { locations, venueType = "" } = req.body;
    console.log("Received locations:", locations);
    console.log("Venue type:", venueType);
    
    if (locations.length < 2) {
      return res.status(400).json({ error: "At least two locations are required." });
    }
    
    // 1. Get weighted epicenter that considers transport modes and outliers
    const epicenter = await computeWeightedEpicenter(locations);
    if (!epicenter) {
      return res.status(500).json({ error: "Unable to compute epicenter from the given addresses." });
    }
    console.log("Calculated Weighted Epicenter:", epicenter);
    
    // 2. Generate a more expansive grid for search (larger area and finer grid)
    //    This helps discover more potential meeting points, especially in urban areas
    const gridSearchResults = await performGridSearch(epicenter, locations);
    if (!gridSearchResults.bestCandidate) {
      return res.status(500).json({ error: "Unable to find suitable meeting points." });
    }
    
    // 3. Search for venues around the best candidate point
    // Prepare venue search options
    const searchOptions = {
      keyword: venueType || "restaurant,cafe,bar", // Use user input or default
      radius: 600,             // Search in a 600m radius (about 7-8 minute walk)
      minRating: 3.8,
      maxResults: 10
    };
    
    const venues = await searchVenues(gridSearchResults.bestCandidate.point, searchOptions);
    
    // 4. Find the best venue from the candidates
    // For each venue, calculate detailed travel times from all starting points
    const venueResults = await Promise.all(venues.map(async (venue) => {
      // Get precise location
      const venueLocation = venue.geometry.location;
      const venueLocationStr = `${venueLocation.lat},${venueLocation.lng}`;
      
      // Calculate travel times for each origin
      const travelDetails = await Promise.all(
        locations.map(async (loc) => {
          const result = await getTravelTimeForOrigin(loc.address, venueLocationStr, loc.transport);
          return {
            origin: loc.address,
            transport: loc.transport,
            duration: result.duration,
            distance: result.distance
          };
        })
      );
      
      // Calculate metrics
      const validTimes = travelDetails.filter(detail => detail.duration !== Infinity);
      const averageDuration = validTimes.length > 0
        ? validTimes.reduce((sum, detail) => sum + detail.duration, 0) / validTimes.length
        : Infinity;
      
      const maxDuration = validTimes.length > 0
        ? Math.max(...validTimes.map(detail => detail.duration))
        : Infinity;
      
      // Calculate standard deviation to measure fairness
      const variance = validTimes.length > 0
        ? validTimes.reduce((sum, detail) => sum + Math.pow(detail.duration - averageDuration, 2), 0) / validTimes.length
        : 0;
      const stdDeviation = Math.sqrt(variance);
      
      // Calculate a combined score (lower is better)
      // We want low average time, low maximum time, and low standard deviation
      const fairnessScore = averageDuration + (0.3 * maxDuration) + (0.5 * stdDeviation);
      
      // Final venue data with travel details
      return {
        name: venue.name,
        address: venue.vicinity || venue.formatted_address,
        location: venue.geometry.location,
        placeId: venue.place_id,
        rating: venue.rating || "Not rated",
        userRatingsTotal: venue.user_ratings_total || 0,
        priceLevel: venue.price_level,
        travelDetails: travelDetails,
        metrics: {
          averageDuration,
          maxDuration,
          stdDeviation,
          fairnessScore
        }
      };
    }));
    
    // 5. Sort venues by the fairness score
    venueResults.sort((a, b) => a.metrics.fairnessScore - b.metrics.fairnessScore);
    
    // If no venues found, use the best grid point
    if (venueResults.length === 0) {
      const fallbackPoint = gridSearchResults.bestCandidate.point;
      const fallbackPointStr = `${fallbackPoint.lat},${fallbackPoint.lng}`;
      
      // Get reverse geocode for address
      let fallbackAddress = "Meeting Point";
      try {
        const geocodeResponse = await axios.get(
          "https://maps.googleapis.com/maps/api/geocode/json",
          { params: { latlng: fallbackPointStr, key: GOOGLE_MAPS_API_KEY } }
        );
        if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
          fallbackAddress = geocodeResponse.data.results[0].formatted_address;
        }
      } catch (error) {
        console.error("Error reverse geocoding fallback point:", error);
      }
      
      // Calculate travel times
      const travelTimes = await Promise.all(
        locations.map(async (loc) => {
          const result = await getTravelTimeForOrigin(loc.address, fallbackPointStr, loc.transport);
          return result.duration;
        })
      );
      
      const validTimes = travelTimes.filter(t => t !== Infinity);
      const averageTime = validTimes.length > 0 
        ? validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length 
        : Infinity;
      
      const result = {
        name: "Meeting Point",
        address: fallbackAddress,
        location: fallbackPoint,
        travelTimes: travelTimes,
        averageTime: averageTime,
        placeId: null
      };
      
      return res.json({ bestLocation: result });
    }
    
    // Return the best venue with all travel details
    const bestVenue = venueResults[0];
    const result = {
      name: bestVenue.name,
      address: bestVenue.address,
      location: bestVenue.location,
      travelTimes: bestVenue.travelDetails.map(detail => detail.duration),
      averageTime: bestVenue.metrics.averageDuration,
      placeId: bestVenue.placeId,
      rating: bestVenue.rating,
      userRatingsTotal: bestVenue.userRatingsTotal,
      // Include full list of top venues for the frontend to display options
      alternativeVenues: venueResults.slice(1, 4).map(venue => ({
        name: venue.name,
        address: venue.address,
        location: venue.location,
        averageTime: venue.metrics.averageDuration,
        placeId: venue.placeId,
        rating: venue.rating
      }))
    };
    
    console.log("Final meeting point:", result.name);
    res.json({ bestLocation: result });
  } catch (error) {
    console.error("Error in compute-location endpoint:", error);
    res.status(500).json({ error: "An error occurred while computing the meeting point." });
  }
});

// Perform a grid search around the epicenter to find the point with the minimum average travel time
async function performGridSearch(epicenter, locations) {
  // Create a more detailed grid with 25 points (5x5 grid) with variable spacing
  const gridCandidates = [];
  const deltas = [-0.008, -0.004, 0, 0.004, 0.008]; // Wider range with more samples
  
  for (const latDelta of deltas) {
    for (const lngDelta of deltas) {
      gridCandidates.push({ 
        lat: epicenter.lat + latDelta, 
        lng: epicenter.lng + lngDelta 
      });
    }
  }
  
  // For each grid point, calculate travel times from all origins
  const candidateResults = await Promise.all(
    gridCandidates.map(async (point) => {
      const pointStr = `${point.lat},${point.lng}`;
      
      const travelResults = await Promise.all(
        locations.map(async (loc) => {
          const result = await getTravelTimeForOrigin(loc.address, pointStr, loc.transport);
          return result;
        })
      );
      
      // Calculate multiple metrics
      const validTimes = travelResults.filter(r => r.duration !== Infinity);
      if (validTimes.length === 0) {
        return { 
          point, 
          travelResults, 
          averageDuration: Infinity,
          maxDuration: Infinity,
          fairnessScore: Infinity
        };
      }
      
      const averageDuration = validTimes.reduce((sum, r) => sum + r.duration, 0) / validTimes.length;
      const maxDuration = Math.max(...validTimes.map(r => r.duration));
      
      // Calculate standard deviation to measure fairness
      const variance = validTimes.reduce((sum, r) => sum + Math.pow(r.duration - averageDuration, 2), 0) / validTimes.length;
      const stdDeviation = Math.sqrt(variance);
      
      // Combine these metrics into a single score
      // Balance average time with fairness (low standard deviation)
      // and ensure no one person has to travel too far (max duration)
      const fairnessScore = averageDuration + (0.3 * maxDuration) + (0.5 * stdDeviation);
      
      return { point, travelResults, averageDuration, maxDuration, stdDeviation, fairnessScore };
    })
  );
  
  // Sort by the fairness score
  candidateResults.sort((a, b) => a.fairnessScore - b.fairnessScore);
  
  return {
    bestCandidate: candidateResults[0],
    allCandidates: candidateResults
  };
}

// Listen on the port provided by Heroku or fallback to 5001 locally.
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});