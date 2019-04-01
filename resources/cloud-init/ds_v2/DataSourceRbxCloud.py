# vi: ts=4 expandtab
#
#    Copyright (C) 2016 Warsaw Data Center
#
#    Author: Malwina Leis <m.leis@rootbox.com>
#    Author: Grzegorz Brzeski <gregory@rootbox.io>
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License version 3, as
#    published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

"""
This file contains code used to gather the user data passed to an
instance on rootbox / hyperone cloud platforms
"""
import errno
import os
import os.path
import socket

from cloudinit import log as logging
from cloudinit import sources
from cloudinit import util
from cloudinit.netinfo import netdev_info

LOG = logging.getLogger(__name__)
ETC_HOSTS = '/etc/hosts'


def get_manage_etc_hosts():
    hosts = _read_file(ETC_HOSTS)
    if hosts:
        LOG.debug('/etc/hosts exists - setting manage_etc_hosts to False')
        return False
    LOG.debug('/etc/hosts does not exists - setting manage_etc_hosts to True')
    return True


def _read_file(filepath):
    try:
        content = util.load_file(filepath).strip()
    except IOError:
        util.logexc(LOG, 'Failed accessing file: ' + filepath)
        return None
    return content


def _get_meta_data(filepath):
    content = _read_file(filepath)
    if not content:
        return None

    try:
        content = util.load_json(content)
    except Exception:
        util.logexc(LOG, 'Failed parsing meta data file from json.')
        return None

    return content


def generate_network_config(meta_data):
    return {
        'version': 1,
        'config': [
            {
                'type': 'physical',
                'name': 'eth{}'.format(str(i)),
                'mac_address': netadp['macaddress'].lower(),
                'subnets': [
                    {
                        'type': 'static',
                        'address': ip['address'],
                        'netmask': netadp['network']['netmask'],
                        'control': 'auto',
                        'gateway': netadp['network']['gateway'],
                        'dns_nameservers': netadp['network']['dns'][
                            'nameservers']
                    } for ip in netadp['ip']
                ],
            } for i, netadp in enumerate(meta_data['netadp'])
        ]
    }


def read_user_data_callback(mount_dir, distro):
    """
    Description:
        This callback will be applied by util.mount_cb() on the mounted
        file.

    Input:
        mount_dir - Mount directory

    Returns:
        User Data

    """

    meta_data = _get_meta_data(os.path.join(mount_dir, 'cloud.json'))
    user_data = _read_file(os.path.join(mount_dir, 'user.data'))

    username = meta_data['additionalMetadata'].get('username', 'guru')
    ssh_keys = meta_data['additionalMetadata'].get('sshKeys', [])

    hash = None
    if meta_data['additionalMetadata'].get('password'):
        hash = meta_data['additionalMetadata']['password'].get('sha512')

    data = {
        'userdata': user_data,
        'metadata': {
            'instance-id': meta_data['vm']['_id'],
            'local-hostname': meta_data['vm']['name'],
            'public-keys': []
        },
        'cfg': {
            'ssh_pwauth': True,
            'disable_root': True,
            'system_info': {
                'default_user': {
                    'name': username,
                    'gecos': username,
                    'sudo': ['ALL=(ALL) NOPASSWD:ALL'],
                    'passwd': hash,
                    'lock_passwd': False,
                    'ssh_authorized_keys': ssh_keys,
                    'shell': '/bin/bash'
                }
            },
            'network_config': generate_network_config(meta_data),
            'manage_etc_hosts': get_manage_etc_hosts()
        },
    }

    LOG.debug('returning DATA object:')
    LOG.debug(data)

    return data


class DataSourceRbxCloud(sources.DataSource):
    def __init__(self, sys_cfg, distro, paths):
        sources.DataSource.__init__(self, sys_cfg, distro, paths)
        self.seed = None
        self.supported_seed_starts = ("/", "file://")

    def __str__(self):
        root = sources.DataSource.__str__(self)
        return "%s [seed=%s]" % (root, self.seed)

    def get_data(self):
        """
        Description:
            User Data is passed to the launching instance which
            is used to perform instance configuration.
        """

        dev_list = util.find_devs_with("LABEL=CLOUDMD")
        rbx_data = None
        for device in dev_list:
            try:
                rbx_data = util.mount_cb(device, read_user_data_callback,
                                         self.distro.name,
                                         mtype=['vfat','fat'])
                if rbx_data:
                    break
            except OSError as err:
                if err.errno != errno.ENOENT:
                    raise
            except util.MountFailedError as err:
                print(err)
                util.logexc(LOG, "Failed to mount %s when looking for user "
                                 "data", device)
        if not rbx_data:
            util.logexc(LOG, "Failed to load metadata and userdata")
            return False

        self.userdata_raw = rbx_data['userdata']
        self.metadata = rbx_data['metadata']
        self.cfg = rbx_data['cfg']
        return True

    @property
    def network_config(self):
        return self.cfg['network_config']

    @property
    def launch_index(self):
        return None

    def get_instance_id(self):
        return self.metadata['instance-id']

    def get_public_ssh_keys(self):
        return self.metadata['public-keys']

    def get_hostname(self, fqdn=False, _resolve_ip=False, metadata_only=False):
        return self.metadata['local-hostname']

    def get_userdata_raw(self):
        return self.userdata_raw

    def get_config_obj(self):
        return self.cfg


# Used to match classes to dependencies

datasources = [
    (DataSourceRbxCloud, (sources.DEP_FILESYSTEM,)),
]


# Return a list of data sources that match this set of dependencies
def get_datasource_list(depends):
    return sources.list_from_depends(depends, datasources)
