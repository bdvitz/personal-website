# JVM Memory Configuration for Railway (512MB limit)
# This file is read by Railway during deployment

# Calculate memory limits (Railway provides ~512MB)
# Heap: 256MB, MetaSpace: 128MB, leaving ~128MB for native memory
export JAVA_TOOL_OPTIONS="-Xmx256m -Xms128m -XX:MaxMetaspaceSize=128m -XX:MetaspaceSize=64m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+UseStringDeduplication -Djava.security.egd=file:/dev/./urandom"
