# Build the image
podman build -t tiktok-relay .

# Run the container
podman run -d -p 8081:8081 -e TIKTOK_USERNAME=@ultimateshades tiktok-relay
