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

'''
This file contains code used to gather the user data passed to an
instance on rootbox / hyperone cloud platforms 
'''
import errno
import os
import os.path

import socket

from cloudinit import log as logging
from cloudinit import sources
from cloudinit import util
from cloudinit.netinfo import netdev_info


LOG = logging.getLogger(__name__)


def _read_file(filepath):
    try:
        content = util.load_file(filepath).strip()
    except IOError:
        util.logexc(LOG, 'Failed accessing file: '+filepath)
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


def read_user_data_callback( mount_dir, distro ):
    '''
    Description:
        This callback will be applied by util.mount_cb() on the mounted
        file.

    Input:
        mount_dir - Mount directory

    Returns:
        User Data

    '''

    meta_data = _get_meta_data( os.path.join(mount_dir,'cloud.json') )
    user_data = _read_file( os.path.join(mount_dir,'user.data') )

    data = {
        'userdata': user_data,
        'metadata': {
            'instance-id': meta_data['vm']['_id'],
        # This puts keys also for root
            #'public-keys': meta_data['additionalMetadata']['sshKeys'],
            'local-hostname': meta_data['vm']['name']
        },
        'cfg' : {
            'ssh_pwauth' : True,
            'disable_root' : True, 
            'system_info' : {
                   'default_user' : {
                         'name' : meta_data['additionalMetadata'].get('username', 'guru'),
                         'gecos' : meta_data['additionalMetadata'].get('username', 'guru'),
                         'sudo':  [ 'ALL=(ALL) NOPASSWD:ALL' ],
                         'lock_passwd' : False,
                         'ssh_authorized_keys' : meta_data['additionalMetadata']['sshKeys'],
                         'shell' : '/bin/bash'
                    }
            },
            'runcmd' : []
        }
    }

    ETC_HOSTS = '/etc/hosts'
    hosts = _read_file(ETC_HOSTS)
    if hosts:
        data['cfg']['manage_etc_hosts'] = False
        LOG.debug('/etc/hosts exists - setting manage_etc_hosts to False')
    else:
        data['cfg']['manage_etc_hosts'] = True
        LOG.debug('/etc/hosts does not exists - setting manage_etc_hosts to True')

    if meta_data['netadp']:
        netdata = generate_eni(meta_data['netadp'], distro)
        data['metadata']['network-interfaces'] = netdata['eni']
        data['cfg']['runcmd'] = netdata['cmd']
   
    data['cfg']['runcmd'].append("echo '" + meta_data['additionalMetadata'].get('username', 'guru')  + ":"+meta_data['additionalMetadata']['password']['sha512']+"' | chpasswd -e")

    LOG.debug('returning DATA object:')
    LOG.debug(data)

    return data

def generate_eni(netadp, distro):

    LOG.debug("RBX: generate_eni")
    LOG.debug(netadp)

    netdevices = netdev_info()

    ENI = []
    CMD = []
    
    ARPING = "arping -c 2 -S "
    ARPING_RHEL = "arping -c 2 -s "

    LOG.debug("Generating eni for distro: %s", distro)
    if distro == 'rhel' or distro == 'fedora':
        ARPING=ARPING_RHEL

    ENI.append('auto lo')
    ENI.append('iface lo inet loopback')
    ENI.append('')

    default_nic = [ n for n in sorted(netadp, key=lambda k: k['_id']) if n.get('default_gw') == "true" ]
    if (not default_nic) and netadp:
        default_nic = [ sorted(netadp, key=lambda k: k['_id'])[0] ]
        LOG.debug("Default interface mac: %s", default_nic[0].get('macaddress'))
    else: 
        LOG.debug("No netadp to configure")
        return None    
    LOG.debug("Default nic: %s", default_nic[0].get('macaddress'))

    for name, data in netdevices.items():
        ENI.append('\n')
        name_split = name.split(':')
        if len(name_split) > 1 and name_split[1] != "": 
            continue
        name = name_split[0]

        mac = data.get('hwaddr').lower()
        if not mac:
            continue

        nic = [n for n in netadp if n.get('macaddress').lower() == mac]

        if not nic:
            continue

        ip = nic[0].get("ip")
        network = nic[0].get("network")

        ENI.append('auto '+ name)

        if not ip:
            ENI.append('iface ' + name + ' inet manual')
            ENI.append('\tpre-up ip link set '+ name +'  up')
            ENI.append('\tpost-down ip link set ' + name + ' down')
            ENI.append('\n')
            continue

        ENI.append('iface '+name + ' inet static')
        ENI.append('\taddress '+ip[0].get("address"))
        ENI.append('\tnetmask '+network.get("netmask"))
    
        if network.get("gateway"):
            if default_nic[0].get('macaddress') == nic[0].get('macaddress'):
                ENI.append('\tgateway '+network.get("gateway"))
                if network.get("dns").get("nameservers"):
                    ENI.append('\tdns-nameservers ' + ' '.join(network.get("dns").get("nameservers")))

            CMD.append(ARPING + ip[0].get("address") + ' ' + network.get("gateway") + ' &')
            CMD.append(ARPING + ip[0].get("address") + ' ' + int2ip(ip2int(network.get("gateway")) + 2) + ' &')
            CMD.append(ARPING + ip[0].get("address") + ' ' + int2ip(ip2int(network.get("gateway")) + 3) + ' &')

        secondaryAddress = ip[1:]
        if secondaryAddress:
            LOG.debug('RBX: secondaryAddress')
            for index, ip in enumerate(secondaryAddress):
                ENI.append('\tup ip addr add ' + ip.get("address") + '/' + str(netmask_to_cidr(network.get("netmask"))) + ' dev ' + name )
                ENI.append('\tdown ip addr del ' + ip.get("address") + '/' + str(netmask_to_cidr(network.get("netmask"))) + ' dev ' + name )
                if network.get("gateway"):
                    CMD.append(ARPING+ ip.get("address") + ' ' + network.get("gateway") + ' &')
                    CMD.append(ARPING+ ip.get("address") + ' ' + int2ip(ip2int(network.get("gateway"))+2) + ' &')
                    CMD.append(ARPING+ ip.get("address") + ' ' + int2ip(ip2int(network.get("gateway"))+3) + ' &')

        if network.get('routing'):
            for route in network.get('routing'):
                ENI.append('\tup ip route add ' + route.get('destination') + ' via '+ route.get('via') + ' dev ' + name )
                ENI.append('\tdown ip route del ' + route.get('destination') + ' via '+ route.get('via') + ' dev ' + name )


    return { 'eni': "\n".join(ENI), 'cmd' : CMD } 

def netmask_to_cidr(netmask):
    '''
    :param netmask: netmask ip addr (eg: 255.255.255.0)
    :return: equivalent cidr number to given netmask ip (eg: 22)
    '''
    return sum([bin(int(x)).count('1') for x in netmask.split('.')])

def ip2int(addr):                                                               
    parts = addr.split('.')
    return  (int(parts[0]) << 24) + (int(parts[1]) << 16) +  (int(parts[2]) << 8) + int(parts[3]) 

def int2ip(addr):                                                               
    return '.'.join([str(addr >> (i << 3) & 0xFF) for i in range(4)[::-1]])

class DataSourceRbxCloud(sources.DataSource):
    def __init__(self, sys_cfg, distro, paths):
        sources.DataSource.__init__(self, sys_cfg, distro, paths)
        self.seed = None
        self.supported_seed_starts = ("/", "file://")

    def __str__(self):
        root = sources.DataSource.__str__(self)
        return "%s [seed=%s]" % (root, self.seed)

    def get_data(self):
        '''
        Description:
            User Data is passed to the launching instance which
            is used to perform instance configuration.
        '''

        dev_list = util.find_devs_with("LABEL=CLOUDMD")
        for device in dev_list:
            try:
                rbx_data = util.mount_cb(device, read_user_data_callback, self.distro.name)
                if rbx_data:
                    break
            except OSError as err:
                if err.errno != errno.ENOENT:
                    raise
            except util.MountFailedError:
                util.logexc(LOG, "Failed to mount %s when looking for user "
                            "data", device)
        if not rbx_data:
            util.logexc(LOG, "Failed to load metadata and userdata")
            return False

        self.userdata_raw = rbx_data['userdata']
        self.metadata = rbx_data['metadata']
        self.cfg = rbx_data['cfg']

        LOG.debug('RBX: metadata')
        LOG.debug(self.metadata)
        if self.metadata['network-interfaces']:
            LOG.debug("Updating network interfaces from %s", self)
            netdevices = netdev_info()

            for nic, data in netdevices.items():

                ifdown_cmd = ['ifdown', nic]
                ip_down_cmd = ['ip','link','set','dev', nic, 'down']
                ip_flush_cmd = ['ip', 'addr', 'flush', 'dev', nic]

                try:
                    util.subp(ifdown_cmd)
                    LOG.debug("Brought '%s' down.", nic)

                    util.subp(ip_down_cmd)
                    LOG.debug("Brought '%s' down.", nic)

                    util.subp(ip_flush_cmd)
                    LOG.debug("Cleared config of  '%s'.", nic)
                except Exception:
                    LOG.debug("Clearing config of '%s' failed.",  nic)

            self.distro.apply_network(self.metadata['network-interfaces'])

        return True

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

