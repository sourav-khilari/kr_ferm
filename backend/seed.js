const mongoose = require('mongoose');
require('dotenv').config();
const Owner = require('./src/models/Owner');
const Truck = require('./src/models/Truck');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kr_ferm';

// Clean truck numbers to avoid hyphen/space matching issues (e.g. JH10CM-8911 -> JH10CM8911)
function cleanTruckNumber(num) {
  return num.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

const noGstData = [
  { owner: 'Ajit Prasad', trucks: ['JH16K-2033'] },
  { owner: 'Anjani Kumar Singh', trucks: ['JH10CM-8911', 'JH10CK-1488', 'JH09BC-9069'] },
  { owner: 'Ashok Kumar Sinha', trucks: ['JH10S-7222'] },
  { owner: 'Chand Muni Devi', trucks: ['JH10U-0351', 'JH10CC-4660', 'JH10P-8667', 'JH09U-7351', 'JH10BG-2541', 'JH10BG-4680'] },
  { owner: 'Dasarath Prasad', trucks: ['JH10CD-4283'] },
  { owner: 'Faruqe Ansari', trucks: ['JH10U-8886'] },
  { owner: 'Hareram Singh', trucks: ['JH02H-0731', 'JH10AA-2104', 'JH10AG-5749'] },
  { owner: 'Hatim Khan', trucks: ['JH02W-2214', 'JH10CD-8943'] },
  { owner: 'Jai Ram Singh (HUF)', trucks: ['JH10R-4997', 'JH10U-6365', 'JH10AJ-8909', 'JH10BM-1369', 'JH10BM-0951', 'JH10BM-1542', 'JH10BM-2316', 'JH10BM-5484', 'JH10BM-8024'] },
  { owner: 'Kameshar Rai', trucks: ['JH20H-3630'] },
  { owner: 'Kashim Khan', trucks: ['JH10U-9039', 'JH10AD-9893'] },
  { owner: 'Kumari Kavita', trucks: ['JH10S-5789', 'JH10BN-9941'] },
  { owner: 'Mihir Kumar Mandal', trucks: ['JH10M-8245'] },
  { owner: 'Parash Kumar Singh', trucks: ['JH10CP-9123'] },
  { owner: 'Pawan Kumar Singh (HUF)', trucks: ['JH10CG-5774', 'JH10BF-4748', 'JH10BP-1773', 'JH10BF-3629'] },
  { owner: 'Phulwanti Devi', trucks: ['JH10V-6315', 'JH10AM-6318', 'JH10AV-7812', 'JH10AV-8385', 'JH10BB-5363', 'JH10BG-2260'] },
  { owner: 'Ram Binod Mishra', trucks: ['JH10U-0819'] },
  { owner: 'Ranvir Kumar', trucks: ['BR06GD-3052'] },
  { owner: 'Roshan Kumar Sinha', trucks: ['JH15P-2241'] },
  { owner: 'Arup Kumar Malakar', trucks: ['JH10BH-8461'] },
  { owner: 'Shailesh Kumar Singh', trucks: ['JH10CZ-8773'] },
  { owner: 'Sunil Kumar Kataruka (HUF)', trucks: ['BR10GA-5134'] },
  { owner: 'Ashok Kumar Mahato', trucks: ['JH10T-6144'] },
  { owner: 'Daljeet Singh Kangri', trucks: ['JH02X-7878'] },
  { owner: 'Devlal Saw', trucks: ['JH10BV-3024'] },
  { owner: 'Avinash Kumar', trucks: ['JH10BB-4506'] },
  { owner: 'Khushbu Pandey', trucks: ['JH02BH-2293'] }
];

const gstData = [
  { owner: 'Jai Ram Singh', trucks: ['JH10AU-7406', 'JH10AX-2915', 'JH10BB-5774', 'JH10BB-8176', 'JH10BG-6279', 'JH10BG-8994', 'JH10CJ-4932', 'JH10CJ-3023', 'JH10CJ-5889', 'JH10CJ-9152', 'JH10CC-4456', 'JH10CC-0927', 'JH10CB-1844', 'JH10CD-7216', 'JH10CD-4209', 'JH10CD-9316', 'JH10CD-5573', 'JH10CD-5934', 'JH10CD-3947', 'JH10DD-7291', 'JH10CK-2315', 'JH10CK-6975', 'JH10CK-5574', 'JH10CS-5546', 'JH10CS-2723', 'JH10CS-2068', 'JH10CV-6875', 'JH10CV-0420', 'JH10BQ-3392', 'JH02AU-8292'] },
  { owner: 'Ranjan Singh', trucks: ['JH10BS-7836', 'JH10CC-6172', 'JH10BY-2296'] },
  { owner: 'Ramesh Kumar Jindal', trucks: ['JH10BL-1888', 'JH10BL-7288', 'JH10CE-7288', 'JH10CE-3688', 'JH10CJ-2488', 'JH10CJ-2588'] },
  { owner: 'Bijendra Kumar Singh', trucks: ['JH10Q-8469', 'JH10R-0621', 'JH10BV-1707', 'JH10BV-7072', 'JH10CJ-6071', 'JH10CK-7011', 'JH10CK-7924', 'JH10CM-1039', 'JH10CM-3841', 'JH10CV-8999', 'JH10CP-3242', 'JH10CR-7847', 'JH10CS-3233', 'JH10CS-1355', 'JH10CK-7962', 'JH02AR-5618', 'JH04N-1776', 'JH10CJ-2474'] },
  { owner: 'Sachida Nand Singh', trucks: ['JH09J-5415', 'JH10AU-5850', 'JH10P-7767', 'JH09T-5451', 'JH10U-0469', 'JH10X-6353', 'JH10T-3277', 'JH10CJ-9130', 'JH10CJ-5568', 'JH10CJ-9298', 'JH10BB-2260', 'JH10BW-4828', 'JH10BW-3484', 'JH10CD-2297', 'JH10CD-1434', 'JH10CD-9187', 'JH10BL-1028', 'JH10BL-4252', 'JH10CD-6225', 'JH10CD-0977', 'JH10CD-2468', 'JH10CK-7471', 'JH10CK-6411', 'JH10CK-7332', 'JH10CN-0641', 'JH10CN-1564', 'JH10CR-8289', 'JH10CR-3623', 'JH10CR-8581', 'JH10DA-0533'] },
  { owner: 'Urmila Kumari', trucks: ['JH10CX-7141', 'JH10CX-0514', 'JH10BB-8557', 'JH10U-9310', 'JH10AR-0417', 'JH10AU-0771', 'JH10AW-8663', 'JH10BF-9678'] },
  { owner: 'Shrawan Kumar Singh', trucks: ['JH01AE-1511', 'JH01Y-9111', 'JH01V-7631', 'JH10J-9011', 'JH10CJ-7371', 'JH10CJ-2861', 'JH02S-4822', 'JH01BK-4580', 'JH10BF-0431', 'JH10BF-9233', 'JH10BR-6513', 'JH10BR-6254'] },
  { owner: 'Nirmala Kumari', trucks: ['JH10AW-3938', 'JH10BM-9011', 'JH10BM-7103', 'JH10CD-3865', 'JH10CD-5123', 'JH10CQ-2470', 'JH10CQ-3870'] },
  { owner: 'M/s Mallick Enterprises (Md. Kamran Akhter)', trucks: ['JH10AB-4115', 'JH10BN-4992', 'JH10CC-0795'] },
  { owner: 'Mohammed Numan Akhter', trucks: ['JH10AD-6211', 'JH10CN-6526'] },
  { owner: 'Rajesh Kumar Yadav', trucks: ['JH10W-6707'] },
  { owner: 'Ajay Kumar Mandal', trucks: ['JH10CK-0283', 'JH10CK-0438'] },
  { owner: 'Maa Ambey Mining (Dhirendra Kumar Yadav)', trucks: ['JH10CD-2857', 'JH10CD-2829', 'JH10CE-4722', 'JH10CE-2763', 'JH11AG-0663', 'JH11AG-8195'] },
  { owner: 'Kumkum Transport (Shiv Kumar Yadav)', trucks: ['JH10CD-3050', 'JH10CD-1157', 'JH10CF-6043'] },
  { owner: 'Kali Charan Gowala', trucks: ['JH10CD-9606', 'JH10CF-7596'] },
  { owner: 'Mukesh Kumar Pandey', trucks: ['JH10CC-3890', 'JH10CN-0880'] },
  { owner: 'Ajay Kumar Pandey', trucks: ['JH10CC-9541', 'JH10CN-7140'] },
  { owner: 'Naresh Jindal', trucks: ['JH10CL-8333'] },
  { owner: 'Ashok Kumar Sinha HUF', trucks: ['JH10CS-9435'] },
  { owner: 'Khan Goods Carrier', trucks: ['JH10CR-7546', 'JH10CS-6470', 'JH10CZ-4881'] },
  { owner: 'Madan Kumar Jha', trucks: ['JH10S-0392', 'JH10P-7592'] },
  { owner: 'Saroj Khan', trucks: ['JH10BL-1804', 'JH10Z-8137', 'JH10CN-5609', 'JH10CN-8193', 'JH10BL-7488', 'JH10CJ-2501', 'JH10CK-1837'] },
  { owner: 'Jitendra Kumar', trucks: ['JH10AR-4741', 'JH10AU-7156', 'JH10AX-0594', 'JH10CE-7949', 'JH10CE-4309', 'JH10CK-4679', 'JH10CK-2442', 'JH10BJ-8232', 'JH10BL-2295', 'JH10BL-9404'] },
  { owner: 'Pawan Kumar Singh', trucks: ['JH10CV-2904', 'JH10CV-0774', 'JH10BW-1216', 'JH10BW-7948', 'JH10CD-9850', 'JH10CD-9065', 'JH10CD-7822', 'JH10CG-3223', 'JH10N-8011', 'JH10S-1621', 'JH02P-2241', 'JH10CJ-9468', 'JH10CJ-0253', 'JH10CJ-4613', 'JH10CJ-4412', 'JH10CK-0330', 'JH10CK-0667', 'JH10CK-3675', 'JH10AH-4702', 'JH10AL-9155', 'JH10AU-7405', 'JH10CS-3051', 'JH10CS-6367', 'JH10CS-9284', 'JH10AW-4586', 'JH10CF-9533', 'JH10BK-5802', 'JH10BP-0808', 'JH10BP-7211', 'JH10BP-8733', 'JH10BU-9957', 'JH10BL-0695', 'JH10BL-4917', 'JH10BZ-9616', 'JH10BZ-5593', 'JH10BZ-7466', 'JH10CG-7498', 'JH10CD-4965', 'JH10CD-8822', 'JH10CD-0832', 'JH10CD-8426', 'JH10CN-0939', 'JH10CN-6360', 'JH10BT-5051', 'JH10BT-0561', 'JH10CK-9283', 'JH10DJ-2065', 'JH10DH-3870', 'JH02AR-0327', 'JH10CF-1859'] }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing Owners and Trucks
    await Owner.deleteMany({});
    await Truck.deleteMany({});
    console.log('Cleared existing owner and truck master data.');

    // Seed Non-GST Owners & Trucks
    for (const item of noGstData) {
      const owner = new Owner({
        name: item.owner,
        gstApplicable: false,
        gstNumber: '',
        tdsPercentage: 1.0, // Default 1% TDS for individuals/non-gst
        status: 'Active'
      });
      await owner.save();

      for (const tNum of item.trucks) {
        const truck = new Truck({
          truckNumber: cleanTruckNumber(tNum),
          owner: owner._id,
          status: 'Active'
        });
        await truck.save();
      }
    }
    console.log(`Seeded ${noGstData.length} Non-GST Owners.`);

    // Seed GST Owners & Trucks
    for (const item of gstData) {
      // Generate a dummy GSTIN using the owner's name initials
      const initials = item.owner.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase().padEnd(5, 'X');
      const dummyGstNumber = `22${initials}1234A1Z5`;

      const owner = new Owner({
        name: item.owner,
        gstApplicable: true,
        gstNumber: dummyGstNumber,
        tdsPercentage: 2.0, // Default 2% TDS for corporate/GST owners
        status: 'Active'
      });
      await owner.save();

      for (const tNum of item.trucks) {
        const truck = new Truck({
          truckNumber: cleanTruckNumber(tNum),
          owner: owner._id,
          status: 'Active'
        });
        await truck.save();
      }
    }
    console.log(`Seeded ${gstData.length} GST Owners.`);

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
