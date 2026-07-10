const Owner = require('../models/Owner');
const Truck = require('../models/Truck');
const UploadedRow = require('../models/UploadedRow');
const DieselRow = require('../models/DieselRow');

class OwnerSummaryService {
  async getOwnerSummary({ fromDate, toDate }) {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch all active Owners
    const owners = await Owner.find({ status: 'Active' });

    // 2. Fetch all active Trucks
    const trucks = await Truck.find({ status: 'Active' }).populate('owner');

    // 3. Load all Payment rows & Diesel rows within target range
    const paymentRows = await UploadedRow.find({ date: { $gte: start, $lte: end } });
    const dieselRows = await DieselRow.find({ date: { $gte: start, $lte: end } });

    // Create indexes for quick aggregation
    const paymentMap = new Map(); // truckNumber (cleaned) -> array of paymentRows
    paymentRows.forEach(r => {
      const clean = r.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      if (!paymentMap.has(clean)) paymentMap.set(clean, []);
      paymentMap.get(clean).push(r);
    });

    const dieselMap = new Map(); // vehicleNo (cleaned) -> array of dieselRows
    dieselRows.forEach(r => {
      const clean = r.vehicleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      if (!dieselMap.has(clean)) dieselMap.set(clean, []);
      dieselMap.get(clean).push(r);
    });

    // 4. Build summary per owner
    const summaryData = [];

    for (const owner of owners) {
      // Find all trucks for this owner
      const ownerTrucks = trucks.filter(t => t.owner && t.owner._id.toString() === owner._id.toString());
      
      const truckSummaries = [];
      let ownerTotalGross = 0;
      let ownerTotalDiesel = 0;
      let ownerTotalShortage = 0;

      ownerTrucks.forEach(t => {
        const cleanNo = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

        // Calculate Gross Pay (Sum of Amount from Payment rows)
        const pRows = paymentMap.get(cleanNo) || [];
        const grossPay = pRows.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Calculate Diesel Amount (Sum of Amount from Diesel rows)
        const dRows = dieselMap.get(cleanNo) || [];
        const dieselAmt = dRows.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Calculate Shortage (Sum of shortage column from Payment rows)
        const shortageAmt = pRows.reduce((sum, r) => sum + (r.shortage || 0), 0);

        ownerTotalGross += grossPay;
        ownerTotalDiesel += dieselAmt;
        ownerTotalShortage += shortageAmt;

        truckSummaries.push({
          truckNumber: t.truckNumber,
          grossPay,
          diesel: dieselAmt,
          shortage: shortageAmt
        });
      });

      // Filter: Only include owners with Owner Gross > 0
      if (ownerTotalGross === 0) {
        continue;
      }

      // Calculations according to report type (GST / RCM)
      const tdsRate = owner.tdsPercentage !== undefined && owner.tdsPercentage !== null 
        ? owner.tdsPercentage / 100 
        : 0.01; // default 1%

      const tdsValue = ownerTotalGross * tdsRate;

      let calculation = {};

      if (owner.gstApplicable) {
        // GST Calculations
        const taxableValue = ownerTotalGross;
        const cgst = taxableValue * 0.09;
        const sgst = taxableValue * 0.09;
        const rawInvoice = taxableValue + cgst + sgst;
        const roundedInvoice = Math.round(rawInvoice);
        const roundOff = roundedInvoice - rawInvoice;

        const netPayment = roundedInvoice - ownerTotalDiesel - ownerTotalShortage - tdsValue;

        calculation = {
          gstApplicable: true,
          taxableValue,
          cgst,
          sgst,
          roundOff,
          invoiceValue: roundedInvoice,
          totalDiesel: ownerTotalDiesel,
          lessShortage: ownerTotalShortage,
          tds: tdsValue,
          netPayment
        };
      } else {
        // RCM Calculations
        const grossAfterDiesel = ownerTotalGross - ownerTotalDiesel;
        const netPayment = grossAfterDiesel - ownerTotalShortage - tdsValue;

        calculation = {
          gstApplicable: false,
          totalPay: ownerTotalGross,
          totalDiesel: ownerTotalDiesel,
          grossAfterDiesel,
          tds: tdsValue,
          shortage: ownerTotalShortage,
          netPayment
        };
      }

      summaryData.push({
        ownerId: owner._id,
        ownerName: owner.name,
        gstNumber: owner.gstNumber,
        gstApplicable: owner.gstApplicable,
        trucks: truckSummaries,
        totals: calculation
      });
    }

    // Sort by Owner Name
    summaryData.sort((a, b) => a.ownerName.localeCompare(b.ownerName));

    return summaryData;
  }
}

module.exports = new OwnerSummaryService();
