#!/bin/bash
# Setup stuff after other installs
# root user
# apt deps:
script_name="$(basename $0)"
echo "****START-ENCD-INFO($script_name)****"
a2enmod headers
a2enmod proxy_http
a2enmod rewrite
a2enmod ssl
a2ensite encoded.conf
a2dissite 000-default
a2enconf logging
a2disconf charset
a2disconf security
a2disconf localized-error-pages
a2disconf other-vhosts-access-log
a2disconf serve-cgi-bin
echo "****END-ENCD-INFO($script_name)****"
