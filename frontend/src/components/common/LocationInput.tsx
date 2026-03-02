import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';

interface LocationInputProps {
    onSelect: (location: {
        latitude: number;
        longitude: number;
        placeName: string;
    }) => void;
    placeholder?: string;
    className?: string; // Kept for compatibility, though wrapper styling might be limited
    initialValue?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onChange?: (value: string) => void;
    hideAttribution?: boolean;
}

export function LocationInput({
    onSelect,
    placeholder = 'Town or Postcode',
    className = '',
    initialValue = '',
    onKeyDown,
    onChange,
    hideAttribution = false
}: LocationInputProps) {

    const handleSelect = (place: { address: string; latitude: number; longitude: number }) => {
        onSelect({
            latitude: place.latitude,
            longitude: place.longitude,
            placeName: place.address,
        });
    };

    return (
        <div className={className} onKeyDown={onKeyDown}>
            <PlacesAutocomplete
                onSelect={handleSelect}
                onInputChange={onChange}
                defaultValue={initialValue}
                placeholder={placeholder}
                hideAttribution={hideAttribution}
            />
        </div>
    );
}

