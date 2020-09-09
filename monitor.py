import psutil
import time
import sys

PIDS = [465838]
NIC = 'enp4s0'

procs = []
for pid in PIDS:
    procs.append(psutil.Process(pid))

stats = []
while True:
    try:
        snetio = psutil.net_io_counters(pernic=True)[NIC]
        line = [time.time_ns(), snetio.bytes_sent, snetio.bytes_recv]
        for p in procs:
            d = p.as_dict(attrs=['cpu_percent','memory_full_info'])
            cpu = d['cpu_percent']
            pfullmem = d['memory_full_info']
            line.append(cpu)
            line.append(pfullmem.uss)
        stats.append(line)
        time.sleep(0.25)
    except KeyboardInterrupt:
        for stat in stats:
            print(stat)
        sys.exit()
