// A custom list of Maharashtra colleges and their domains
// This is MUCH faster than an API call for common schools.
// You can add as many as you want here.
const MAHARASHTRA_COLLEGES = [
    {
        "name": "Veermata Jijabai Technological Institute (VJTI), Mumbai",
        "domain": "vjti.ac.in"
    },
    {
        "name": "College of Engineering, Pune (COEP)",
        "domain": "coep.org.in"
    },
    {
        "name": "Sardar Patel Institute of Technology (SPIT), Mumbai",
        "domain": "spit.ac.in"
    },
    {
        "name": "Walchand College of Engineering, Sangli (WCE)",
        "domain": "walchandsangli.ac.in"
    },
    {
        "name": "Vishwakarma Institute of Technology (VIT), Pune",
        "domain": "vit.edu"
    },
    {
        "name": "Ramrao Adik Institute of Technology (RAIT), Navi Mumbai",
        "domain": "rait.ac.in"
    },
    {
        "name": "Mumbai University (MU)",
        "domain": "mu.ac.in"
    },
    {
        "name": "Savitribai Phule Pune University (SPPU)",
        "domain": "unipune.ac.in"
    },
    {
        "name": "K. J. Somaiya College of Engineering (KJSCE)",
        "domain": "somaiya.edu"
    },
    {
        "name": "Thadomal Shahani Engineering College (TSEC), Mumbai",
        "domain": "tsec.edu"
    },
    {
        "name": "Annasaheb Vartak College of Arts, Kedarnath Malhotra College of Commerce, E. S. Andrades College of Science",
        "domain": "avc.ac.in"
    },
    {
        "name": "Vidyavardhini's Bhausaheb Vartak Polytechnic College",
        "domain": "avc.ac.in"
    },

    {
        "name": "D.G. Ruparel College of Arts, Science and Commerce",
        "domain": "ruparel.edu"
    },


];

// A larger list of other Indian colleges for better fallback
const INDIAN_COLLEGES = [
    { "name": "Indian Institute of Technology Bombay (IITB)", "domain": "iitb.ac.in" },
    { "name": "Indian Institute of Technology Delhi (IITD)", "domain": "iitd.ac.in" },
    { "name": "Indian Institute of Technology Kanpur (IITK)", "domain": "iitk.ac.in" },
    { "name": "Indian Institute of Technology Madras (IITM)", "domain": "iitm.ac.in" },
    { "name": "Indian Institute of Technology Kharagpur (IITKGP)", "domain": "iitkgp.ac.in" },
    { "name": "Indian Institute of Technology Roorkee (IITR)", "domain": "iitr.ac.in" },
    { "name": "Indian Institute of Technology Guwahati (IITG)", "domain": "iitg.ac.in" },
    { "name": "National Institute of Technology Trichy (NITT)", "domain": "nitt.edu" },
    { "name": "National Institute of Technology Surathkal (NITK)", "domain": "nitk.ac.in" },
    { "name": "National Institute of Technology Warangal (NITW)", "domain": "nitw.ac.in" },
    { "name": "Birla Institute of Technology and Science, Pilani (BITS Pilani)", "domain": "bits-pilani.ac.in" },
    { "name": "Vellore Institute of Technology (VIT)", "domain": "vit.ac.in" },
    { "name": "Manipal Institute of Technology (MIT)", "domain": "manipal.edu" },
    { "name": "Delhi Technological University (DTU)", "domain": "dtu.ac.in" },
    { "name": "Netaji Subhas University of Technology (NSUT)", "domain": "nsut.ac.in" },
    { "name": "Indian Institute of Information Technology, Allahabad (IIITA)", "domain": "iiita.ac.in" },
    { "name": "Indian Institute of Science (IISc) Bangalore", "domain": "iisc.ac.in" },
    { "name": "Jadavpur University, Kolkata", "domain": "jaduniv.edu.in" },
    { "name": "Anna University, Chennai", "domain": "annauniv.edu" },
    { "name": "Amity University, Noida", "domain": "amity.edu" },
    { "name": "Christ University, Bangalore", "domain": "christuniversity.in" }
];

// Combine both lists into one for searching
// This variable MUST be available in the global scope for landing_page.js
const ALL_LOCAL_COLLEGES = [...MAHARASHTRA_COLLEGES, ...INDIAN_COLLEGES];