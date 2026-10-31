/**
 * Realistic vendor configuration files used by the demo environment and by the
 * upload workflow samples. These are parsed for real by the vendor parsers —
 * nothing here is pre-normalized.
 */

export const CISCO_CORE_01 = `!
! Cisco IOS configuration
hostname Cisco-Core-01
!
aaa new-model
username netadmin privilege 15 secret 5 $1$Xy9z$hAsHeDvAlUeReDaCtEd
enable secret 5 $1$Qw3r$anotherhashedvalue
!
interface GigabitEthernet0/0
 description Management uplink
 ip address 10.0.0.1 255.255.255.0
 zone-member security Management
 no shutdown
!
interface GigabitEthernet0/1
 description Application segment
 ip address 10.0.20.1 255.255.255.0
 zone-member security Application
 no shutdown
!
interface GigabitEthernet0/2
 description Database segment transit
 ip address 10.0.30.1 255.255.255.0
 zone-member security Database
 no shutdown
!
vlan 20
 name APP-TIER
vlan 30
 name DB-TIER
vlan 99
 name MGMT
!
ip route 0.0.0.0 0.0.0.0 10.0.10.1
ip route 10.0.30.0 255.255.255.0 10.0.20.254
router ospf 10
 network 10.0.0.0 0.0.255.255 area 0
!
ip access-list extended MGMT-IN
 permit tcp 10.0.0.0 0.0.0.255 any eq 22
 deny tcp any any eq 23
 permit tcp 10.0.0.0 0.0.0.255 10.0.20.0 0.0.0.255 eq 443
 permit tcp 10.0.0.0 0.0.0.255 10.0.30.0 0.0.0.255 eq 3306
 deny ip any any log
!
ip access-list extended APP-TO-DB
 permit tcp 10.0.20.0 0.0.0.255 10.0.30.0 0.0.0.255 eq 3306
 deny ip any any log
!
line vty 0 4
 transport input ssh
 exec-timeout 10 0
 access-class MGMT-IN in
!
no ip http-server
ip http secure-server
ip ssh version 2
snmp-server group NEXUS-RO v3 priv
logging host 10.0.0.50
logging trap informational
ntp server 10.0.0.53
ip name-server 10.0.0.53
end
`;

export const FORTINET_FW_01 = `config system global
    set hostname "Fortinet-FW-01"
    set admin-telnet enable
    set admin-https-redirect enable
    set admintimeout 480
end
config system admin
    edit "fgadmin"
        set accprofile "super_admin"
        set password ENC 4gT7hAsHeDpAsSwOrD==
        set trusthost1 0.0.0.0 0.0.0.0
    next
end
config system interface
    edit "wan1"
        set ip 203.0.113.10 255.255.255.0
        set allowaccess ping https ssh
        set zone "Internet"
        set status up
    next
    edit "port2"
        set ip 10.0.10.1 255.255.255.0
        set allowaccess ping
        set zone "DMZ"
        set status up
    next
    edit "port3"
        set ip 10.0.20.254 255.255.255.0
        set allowaccess ping
        set zone "Application"
        set status up
    next
    edit "port4"
        set ip 10.0.0.254 255.255.255.0
        set allowaccess ping https ssh
        set zone "Management"
        set status up
    next
end
config router static
    edit 1
        set dst 0.0.0.0 0.0.0.0
        set gateway 203.0.113.1
        set device "wan1"
    next
    edit 2
        set dst 10.0.30.0 255.255.255.0
        set gateway 10.0.20.1
        set device "port3"
    next
end
config firewall policy
    edit 1
        set name "Internet-to-DMZ-Web"
        set srcintf "Internet"
        set dstintf "DMZ"
        set srcaddr "all"
        set dstaddr "Web-Server"
        set service "HTTPS"
        set action accept
        set logtraffic all
    next
    edit 2
        set name "Block-Internet-to-Database"
        set srcintf "Internet"
        set dstintf "Database"
        set srcaddr "all"
        set dstaddr "Prod-DB"
        set service "ALL"
        set action deny
        set logtraffic all
    next
    edit 3
        set name "Block-Internet-to-Management"
        set srcintf "Internet"
        set dstintf "Management"
        set srcaddr "all"
        set dstaddr "all"
        set service "ALL"
        set action deny
        set logtraffic all
    next
    edit 4
        set name "DMZ-to-App-Tier"
        set srcintf "DMZ"
        set dstintf "Application"
        set srcaddr "Web-Server"
        set dstaddr "App-Servers"
        set service "HTTPS"
        set action accept
        set logtraffic all
    next
    edit 5
        set name "Admin-to-Firewall-SSH"
        set srcintf "Management"
        set dstintf "Management"
        set srcaddr "Admin-Network"
        set dstaddr "all"
        set service "SSH"
        set action accept
        set logtraffic all
    next
    edit 6
        set name "Implicit-Deny"
        set srcintf "any"
        set dstintf "any"
        set srcaddr "all"
        set dstaddr "all"
        set service "ALL"
        set action deny
        set logtraffic all
    next
end
config firewall vip
    edit "Web-Publish"
        set extip 203.0.113.10
        set extport 443
        set mappedip 10.0.10.20
        set mappedport 443
    next
end
config vpn ipsec phase1-interface
    edit "VendorA-VPN"
        set remote-gw 198.51.100.7
        set proposal aes256-sha256
        set psksecret ENC pReSHaReDkEyReDaCtEd
    next
end
config log setting
    set status enable
    set syslog-server 10.0.0.50
end
config system snmp sysinfo
    set status enable
end
config system snmp community
    edit 1
        set name "public"
        set query-v1-status enable
    next
end
config system ntp
    set ntpsync enable
    set server "10.0.0.53"
end
config system dns
    set primary 10.0.0.53
end
`;

export const JUNIPER_EDGE_01 = `set system host-name Juniper-Edge-01
set system services ssh protocol-version v2
set system services telnet
set system services web-management https interface ge-0/0/1.0
set system login user netops class super-user authentication encrypted-password "$6$hAsHeD$juniperhashredacted"
set system syslog host 10.0.0.50 any notice
set system ntp server 10.0.0.53
set system name-server 10.0.0.53
set interfaces ge-0/0/0 unit 0 description Vendor-VPN-transit family inet address 172.16.50.1/24
set interfaces ge-0/0/1 unit 0 description DMZ-edge family inet address 10.0.10.2/24
set interfaces ge-0/0/2 unit 0 description Management family inet address 10.0.0.2/24
set vlans VENDOR vlan-id 50
set vlans DMZ-EDGE vlan-id 10
set routing-options static route 0.0.0.0/0 next-hop 10.0.10.1
set routing-options static route 10.0.0.0/24 next-hop 10.0.0.254
set protocols bgp group EDGE neighbor 203.0.113.1 peer-as 64512
set security zones security-zone Vendor interfaces ge-0/0/0.0
set security zones security-zone DMZ interfaces ge-0/0/1.0
set security zones security-zone Management interfaces ge-0/0/2.0
set security policies from-zone Vendor to-zone Management policy vendor-jump-ssh match source-address any destination-address Jump-Server application junos-ssh
set security policies from-zone Vendor to-zone Management policy vendor-jump-ssh then permit log session-init
set security policies from-zone Vendor to-zone Management policy vendor-mgmt-rdp match source-address any destination-address Jump-Server application junos-rdp
set security policies from-zone Vendor to-zone Management policy vendor-mgmt-rdp then permit
set security policies from-zone Vendor to-zone Application policy vendor-app-any match source-address any destination-address any application any
set security policies from-zone Vendor to-zone Application policy vendor-app-any then permit
set security policies from-zone Internet to-zone Management policy block-inet-mgmt match source-address any destination-address any application any
set security policies from-zone Internet to-zone Management policy block-inet-mgmt then deny log session-init
set security policies default-policy deny-all
set security nat source rule-set vendor-egress from zone Vendor to zone Management
set security ike gateway VendorA-VPN address 198.51.100.7 external-interface ge-0/0/0.0
set security ipsec vpn VendorA-VPN ike gateway VendorA-VPN ipsec-policy aes256-sha256
set snmp community public authorization read-only
`;

export const PALOALTO_FW_02 = `set deviceconfig system hostname PaloAlto-FW-02
set deviceconfig system service disable-telnet yes
set deviceconfig system service disable-http yes
set deviceconfig system service disable-ssh no
set deviceconfig system permitted-ip 10.0.0.0/24
set deviceconfig system idle-timeout 15
set deviceconfig system snmp-setting snmp-system version v3
set deviceconfig system ntp-servers primary-ntp-server 10.0.0.53
set deviceconfig system dns-setting servers primary 10.0.0.53
set deviceconfig system login-banner "Authorized access only"
set mgt-config users paadmin phash $5$hAsHeDpAnOsPaSsWoRd
set network interface ethernet ethernet1/1 layer3 ip 10.0.20.253/24 comment Application-tier
set network interface ethernet ethernet1/2 layer3 ip 10.0.30.254/24 comment Database-tier
set network interface ethernet ethernet1/3 layer3 ip 10.100.0.254/16 comment Cloud-interconnect
set network interface ethernet ethernet1/4 layer3 ip 10.0.0.253/24 comment Management
set zone Application network layer3 ethernet1/1
set zone Database network layer3 ethernet1/2
set zone Cloud network layer3 ethernet1/3
set zone Management network layer3 ethernet1/4
set network virtual-router default routing-table ip static-route to-app destination 10.0.20.0/24 nexthop ip-address 10.0.20.1
set network virtual-router default routing-table ip static-route default destination 0.0.0.0/0 nexthop ip-address 10.0.20.1
set rulebase security rules Allow-App-to-DB from Application to Database source App-Servers destination Prod-DB service tcp-3306 action allow log-end yes
set rulebase security rules Allow-Mgmt-to-DB from Management to Database source Admin-Network destination Prod-DB service tcp-3306 action allow log-end yes
set rulebase security rules Allow-Cloud-Replication from Cloud to Database source Cloud-Replica destination Prod-DB service tcp-3306 action allow log-end yes
set rulebase security rules Block-Internet-to-DB from Internet to Database source any destination Prod-DB service any action deny log-end yes
set rulebase security rules Deny-All from any to any source any destination any service any action deny log-end yes
set rulebase nat rules DB-Egress source-translation dynamic-ip-and-port interface-address ethernet1/1 from Database to Application
set shared log-settings syslog nexus-siem server 10.0.0.50 transport UDP port 514
set deviceconfig setting management hostname-type-in-syslog yes
`;

export const SAMPLE_UPLOADS: {label: string;fileName: string;raw: string;}[] = [
{ label: 'Cisco IOS — core router', fileName: 'cisco-core-01.cfg', raw: CISCO_CORE_01 },
{ label: 'Fortinet FortiOS — perimeter firewall', fileName: 'fortinet-fw-01.conf', raw: FORTINET_FW_01 },
{ label: 'Juniper JunOS — edge router', fileName: 'juniper-edge-01.set', raw: JUNIPER_EDGE_01 },
{ label: 'Palo Alto PAN-OS — internal firewall', fileName: 'paloalto-fw-02.txt', raw: PALOALTO_FW_02 }];