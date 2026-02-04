FROM matrixdotorg/synapse:latest

# Copy your config to the safe location
COPY homeserver.yaml /etc/synapse/homeserver.yaml
COPY registration.yaml /etc/synapse/registration.yaml

# Reset the Entrypoint to bypass the "auto-generate" script
ENTRYPOINT ["python3", "-m", "synapse.app.homeserver"]

# Tell it exactly where the config is
CMD ["--config-path", "/etc/synapse/homeserver.yaml"]