#!/usr/bin/env python3
"""
Direct USB printing to Zebra printers using libusb.
Bypasses CUPS driver filters for reliable ZPL printing on macOS.
"""

import sys
import usb.core
import usb.util

# Zebra Technologies VID
ZEBRA_VID = 0x0A5F

def find_zebra():
    """Find any Zebra printer connected via USB."""
    # Try to find by VID
    devices = list(usb.core.find(find_all=True, idVendor=ZEBRA_VID))
    if devices:
        return devices[0]
    return None

def send_zpl(zpl_data):
    """Send ZPL data directly to the Zebra printer."""
    dev = find_zebra()

    if dev is None:
        print("ERROR: Zebra printer not found", file=sys.stderr)
        return False

    try:
        # Detach kernel driver if active
        for i in range(dev.bNumConfigurations):
            try:
                if dev.is_kernel_driver_active(i):
                    dev.detach_kernel_driver(i)
            except:
                pass

        # Set configuration
        dev.set_configuration()

        # Get output endpoint
        cfg = dev.get_active_configuration()
        intf = cfg[(0, 0)]

        ep_out = usb.util.find_descriptor(
            intf,
            custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT
        )

        if ep_out is None:
            print("ERROR: No output endpoint found", file=sys.stderr)
            return False

        # Send ZPL data
        if isinstance(zpl_data, str):
            zpl_data = zpl_data.encode('utf-8')

        bytes_sent = ep_out.write(zpl_data)
        print(f"OK: Sent {bytes_sent} bytes to Zebra")
        return True

    except usb.core.USBError as e:
        print(f"ERROR: USB error - {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) < 2:
        # Read from stdin
        zpl_data = sys.stdin.read()
    else:
        # Read from file
        filepath = sys.argv[1]
        try:
            with open(filepath, 'r') as f:
                zpl_data = f.read()
        except Exception as e:
            print(f"ERROR: Cannot read file - {e}", file=sys.stderr)
            sys.exit(1)

    if not zpl_data.strip():
        print("ERROR: No ZPL data provided", file=sys.stderr)
        sys.exit(1)

    success = send_zpl(zpl_data)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
