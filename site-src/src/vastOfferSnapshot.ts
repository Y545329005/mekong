// Public Vast.ai listing snapshot, read from rendered rental cards on 2026-10-30.
// Reference inventory snapshot; not a live Mekong supply feed.
// Prices are USD per whole offer per hour. TFLOPS is the whole offer, VRAM is per GPU.
// Disk is currently allocatable capacity, not physical disk total. Unpublished fields stay unknown.
export const vastSnapshot = {
  capturedOn: '2026-10-30',
  source: 'https://cloud.vast.ai/',
  columns: ['offer','location','model','tflops','machine','provider','verified','vram','memoryBandwidth','board','pcie','lanes','pcieBandwidth','cpu','allocatedCpu','totalCpu','allocatedRam','totalRam','diskModel','diskSpeed','diskAvailable','upload','download','ports','cuda','maxDuration','reliability','hourlyPrice'],
  rows: [
    ['48989683','South Korea, KR','1x RTX 5090',108.1,'148900','datacenter:406325',true,32,1456.2,'B850 EAGLE ICE',5,16,48,'AMD Ryzen 7 7800X3D 8-Core Processor',16,16,31,31,'nvme',8759,484.9,559,611,98,13,'1 mon, 1d',99.34,.509],
    ['43688757','South Korea, KR','1x RTX 5090',108.1,'142476','datacenter:406325',true,32,1459.1,'B850 EAGLE ICE',5,16,48.4,'AMD Ryzen 7 7800X3D 8-Core Processor',16,16,31,31,'nvme',5750,520,458,510,98,13,'1 mon, 1d',99.81,.509],
    ['28539924','South Korea, KR','1x RTX 5090',108.1,'29721','host:156806',true,32,1457.5,'B760M-HDVP',5,16,42.1,'12th Gen Core i5-12400F',12,12,64,64,'WD_BLACK SN850X 2000GB',5935,1332.3,843,880,98,12.8,'4 mon.',99.88,.609],
    ['45380573','South Korea, KR','1x RTX 5090',108.1,'100674','datacenter:406325',true,32,1456.2,'B850 EAGLE ICE',5,16,51.6,'AMD Ryzen 7 7800X3D 8-Core Processor',8,8,31,31,'nvme',1788,257,575,596,98,13,'1 mon, 1d',99.15,.509],
    ['50103209','Pennsylvania, US','1x RTX 5090',107.6,'145191','host:43746',true,32,1454.7,'TURIND8-2L2T',5,16,54.4,'AMD EPYC 9135 16-Core Processor',8,32,64,257,'WD_BLACK SN8100 2000GB',17143,555,1671,1835,99,13,'15 days',99.71,.676],
    ['47877848','Pennsylvania, US','1x RTX 5090',107.6,'71551','host:43746',true,32,1457.3,'TURIND8-2L2T',5,16,54.4,'AMD EPYC 9135 16-Core Processor',8,32,64,257,'WD_BLACK SN8100 2000GB',21913,515.1,1503,1425,99,13.2,'15 days',99.85,.676],
    ['57917101','South Korea, KR','1x RTX 5090',108.1,'144994','datacenter:406325',true,32,1456.6,'B850 EAGLE ICE',5,16,50.7,'AMD Ryzen 7 7800X3D 8-Core Processor',8,8,31,31,'nvme',501,466.1,279,380,98,13,'1 mon, 1d',99.46,.509],
    ['55827689','United States, US','1x RTX 5090',109.7,'152645','host:467312',true,32,1456.7,'H12SSL-i',4,16,21.6,'AMD EPYC 7V12 64-Core Processor',32,128,64,258,'INTEL SSDPE2KX040T8',2539,738.9,418,478,24,13.2,'5 mon.',99.24,.558],
    ['57867522','California, US','1x RTX 5090',107.6,'152912','host:576518',true,32,1456.5,'T1ADG',4,16,23.4,'AMD EPYC 7K62 48-Core Processor',24,192,64,516,'ZHITAI TiPlus7100 4TB',5182,242.4,949,949,249,13.2,'27 days',98.7,.609],
    ['30720259','Nebraska, US','2x RTX 5090',215.2,'54081','host:72700',true,32,1454.2,'ROME2D32GM-2T',4,16,26.5,'AMD EPYC 7B13 64-Core Processor',64,256,258,1032,'KCD6XLUL7T68',7092,1176.7,1604,1754,256,13,'14 mon.',99.68,1.47],
    ['56665364','Indiana, US','2x RTX 5090',218.3,'143514','host:393738',true,32,1457.2,'MPG X670E CARBON WIFI',5,8,27.5,'AMD Ryzen 5 7600X 6-Core Processor',12,12,63,63,'KINGSTON SNV3S1000G',2831,392,1383,858,248,13,'259 mon.',99.14,1.212],
    ['44085957','Colorado, US','2x RTX 5090',215.2,'138905','host:517294',true,32,1457.1,'ProArt X870E-CREATOR WIFI',5,8,27.5,'AMD Ryzen 9 9900X 12-Core Processor',24,24,126,126,'Samsung SSD 990 PRO 2TB',4888,785,221,484,99,13,'13 days',99.67,1.403],
    ['56787188','Ohio, US','2x RTX 5090',215.2,'31526','host:49107',true,32,1454.9,'GENOAD12M3-2Q',5,16,54.2,'AMD EPYC 9384X 32-Core Processor',32,64,387,773,'WD_BLACK SN850X 8000GB',6927,3726.9,1157,2201,256,13.4,'14 days',99.82,2.409],
    ['45172707','Japan, JP','1x H200 NVL',48.3,'144381','host:612739',true,140,3878.9,'X14DBM-SP',5,16,52.9,'Xeon 6515P',32,64,516,1032,'MTFDKCC1T9TGP-1BK1JABYY',23040,514,1356,2802,256,13.2,'7 days',99.81,4.009],
    ['47379027','Japan, JP','1x H200 NVL',48.3,'147075','host:612739',true,140,3866.5,'X14DBM-SP',5,16,52.9,'Xeon 6515P',32,64,516,1032,'SAMSUNG MZWL61T9HFLT-00AW7',29900,267.5,1275,1960,256,13.2,'7 days',99.8,4.143],
    ['28418868','Texas, US','1x H200 NVL',48.3,'49537','host:207608',true,140,3895.1,'H14DSG-O-',5,16,55,'AMD EPYC 9255 24-Core Processor',24,96,193,774,'SAMSUNG MZQL23T8HCLS-00A07',4123,73.3,757,793,99,13.3,'1 mon, 29d',98.7,3.756],
    ['45315037','Washington, US','1x H200 NVL',48.3,'98731','host:143636',true,140,3875.5,'ROME2D32GM-2T',4,16,21.7,'AMD EPYC 7402 24-Core Processor',32,96,172,516,'WD_BLACK SN7100 4TB',3040,591.5,907,891,133,13.2,'2 mon, 21d',99.79,4.045],
    ['28418865','Texas, US','2x H200 NVL',96.5,'49537','host:207608',true,140,3892.6,'H14DSG-O-',5,16,55,'AMD EPYC 9255 24-Core Processor',48,96,387,774,'SAMSUNG MZQL23T8HCLS-00A07',4123,146.5,757,793,199,13.3,'1 mon, 29d',98.7,7.503],
    ['58297932','Florida, US','1x H200 NVL',48.3,'155286','host:743666',true,140,3883.8,'D6053',5,16,54.9,'AMD EPYC 9575F 64-Core Processor',32,256,193,1548,'SAMSUNG MZWL63T8HFLT-00AW7',62266,1541.2,1174,718,124,13,'1 mon, 0d',96.3,4.556],
    ['58297923','Florida, US','2x H200 NVL',96.5,'155286','host:743666',true,140,3879.2,'D6053',5,16,54.9,'AMD EPYC 9575F 64-Core Processor',64,256,387,1548,'SAMSUNG MZWL63T8HFLT-00AW7',62266,3082.3,1174,718,249,13,'1 mon, 0d',96.3,9.103],
    ['50332826','California, US','2x RTX 4090',162.8,'150244','host:647743',true,48,901.2,'BS55M2C1SA',4,16,24.1,'Xeon Gold 6338',32,128,129,516,'INTEL SSDPF2KX038TZ',4440,622,871,824,62,13.2,'22 days',99.7,.996],
    ['45305432','Florida, US','1x RTX 5080',53.7,'144486','host:616858',true,16,783,'X870 Taichi Creator',5,8,27.5,'AMD Ryzen 9 9950X 16-Core Processor',16,32,31,62,'Samsung SSD 990 PRO 2TB',3915,508,1830,1936,49,13.3,'3 mon.',99.79,.378],
    ['55270709','Michigan, US','1x A100 PCIE',15.6,'120760','host:546665',true,40,1314.4,'ROG ZENITH II EXTREME ALPHA',4,16,22.5,'AMD Ryzen Threadripper 3990X 64-Core Processor',64,128,129,258,'Seagate ZP2000GP304001',15035,2940.5,9678,13614,99,13.4,'10 days',99.73,.778],
    ['49067599','Texas, US','1x A100 SXM4',15.6,'146917','host:639771',true,80,1658.2,'C2665',4,16,19,'AMD EPYC 7V12 64-Core Processor',32,256,129,1032,'SAMSUNG MZ1LB3T8HMLA-00007',1988,564.3,8837,9181,256,13,'7 days',99.8,1.253],
    ['47761747','Texas, US','4x RTX 4090',325.6,'43645','host:60400',true,48,900.5,'H13DSG-O-',4,16,25.6,'AMD EPYC 9354 32-Core Processor',64,128,387,774,'Dell Ent NVMe v2 AGN RI U.2 3.84TB',7129,687.5,4337,4810,256,13.4,'14 days',99.06,3.215],
    ['57609433','California, US','2x RTX 5080',106.3,'153966','host:513108',true,16,782.1,'X10DRG-O',3,16,11.8,'Xeon E5-2699 v4',22,88,64,258,'SAMSUNG MZQLB3T8HALS-00007',2345,1601.2,997,3221,24,13.4,'5 mon.',98.7,.658],
  ] as const,
}
