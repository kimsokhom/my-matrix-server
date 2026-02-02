# -------------------------------------------------
# 1️⃣ Base image – the official Synapse image
# -------------------------------------------------
FROM matrixdotorg/synapse:latest

# -------------------------------------------------
# 2️⃣ Copy your custom homeserver.yaml into the image.
#    Synapse expects the config at /data/homeserver.yaml
# -------------------------------------------------
COPY homeserver.yaml /etc/synapse/homeserver.yaml

# -------------------------------------------------
# 3️⃣ (Optional) Install extra Python packages or plugins.
#    Example: RUN pip install matrix-synapse-pushgateway
# -------------------------------------------------
# RUN pip install <your‑extra‑package>

# -------------------------------------------------
# 4️⃣ Expose the port Synapse listens on (default 8008)
# -------------------------------------------------
EXPOSE 8008

# -------------------------------------------------
# 5️⃣ No CMD needed – the upstream image already defines
#    the correct entrypoint that runs Synapse with the
#    config file at /data/homeserver.yaml.
# -------------------------------------------------
