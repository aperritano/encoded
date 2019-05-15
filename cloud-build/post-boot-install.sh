#!/bin/bash
### Run first after cloud init installation
# For general items that did not fit/belong in cloud init
# ubuntu user

# Add team ssh public keys from s3
mv /home/ubuntu/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys2
aws s3 cp --region=us-west-2 %(S3_AUTH_KEYS)s /home/ubuntu/.ssh/authorized_keys
