FROM matrixdotorg/synapse:latest

# Copy config directly
COPY homeserver.yaml /data/homeserver.yaml

EXPOSE 8008

# Run Synapse directly
ENTRYPOINT ["python", "-m", "synapse.app.homeserver"]
CMD ["--config-path=/data/homeserver.yaml"]
