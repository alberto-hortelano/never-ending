FROM node:20
RUN ln -sf /bin/bash /bin/sh
RUN apt-get update -y
RUN apt-get install -y inotify-tools
