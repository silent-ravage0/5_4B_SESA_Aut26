window.MeridianData = (function () {
  "use strict";

  var ICONS = {
    sun:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.6l1.2-6.6-4.8-4.6 6.6-.9z"/></svg>',
    video:'<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 10l6-3v10l-6-3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inbox:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h4l2 3h4l2-3h4" stroke="currentColor" stroke-width="1.6"/><path d="M4 12l1.4-6.6A2 2 0 0 1 7.3 4h9.4a2 2 0 0 1 2 1.4L20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    heartbeat:'<svg viewBox="0 0 24 24" fill="none"><path d="M2 12h4l2-6 4 12 3-9 2 3h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hospital:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 21V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 21h20M9 21v-4h6v4M12 6v6M9 9h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    ticket:'<svg viewBox="0 0 24 24" fill="none"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 5v3M13 16v3M13 9.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    door:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 21V4a1 1 0 0 1 1-1h9v18" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 21h5M3 21h2M13.5 12v.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    exit:'<svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    reset:'<svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 1 3 6.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 17v-5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var DEPT_ICONS = {
    cardiology:'<path d="M12 21s-7-4.5-9.5-9C.5 8 2 4 6 4c2.4 0 3.8 1.3 6 3.5C14.2 5.3 15.6 4 18 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z" stroke="currentColor" stroke-width="1.6"/><path d="M4 12h3l1.5-3 2 5 1.5-3.5 1 1.5h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    neurology:'<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5.4V19a2 2 0 0 0 4 0V6a3 3 0 0 0-1-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5.4V19a2 2 0 0 1-4 0V6a3 3 0 0 1 1-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    orthopedics:'<path d="M6 14a3 3 0 1 1 4-4l4 4a3 3 0 1 1-4 4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.2" cy="10.2" r="1.1" fill="currentColor"/><circle cx="6.6" cy="13.4" r="1.1" fill="currentColor"/><circle cx="17.8" cy="13.8" r="1.1" fill="currentColor"/><circle cx="17.4" cy="10.6" r="1.1" fill="currentColor"/>',
    pediatrics:'<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 8c0-2 1.2-3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    dermatology:'<path d="M12 3c4 4.5 6 7.6 6 10.5A6 6 0 0 1 6 13.5C6 10.6 8 7.5 12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    ent:'<path d="M6 12a6 6 0 0 1 12 0v3a4 4 0 0 1-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="14" cy="19" r="1.6" stroke="currentColor" stroke-width="1.5"/><path d="M6 12V9a2 2 0 1 1 4 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    ophthalmology:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>',
    dental:'<path d="M8 3c-2.5 0-4 2-4 4.5 0 3 1 5.5 1.6 9C6 18.5 7 20 8.3 20c1.2 0 1.4-2.3 1.9-4.3.3-1.2.8-2 1.8-2s1.5.8 1.8 2c.5 2 .7 4.3 1.9 4.3 1.3 0 2.3-1.5 2.7-3.5.6-3.5 1.6-6 1.6-9C20 5 18.5 3 16 3c-1.6 0-2.4.8-4 .8S9.6 3 8 3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'
  };

  var DEPARTMENTS = [
    {id:'cardiology', name:'Cardiology', blurb:'Heart health, from checkups to complex procedures.'},
    {id:'neurology', name:'Neurology', blurb:'Brain, spine, and nervous system care.'},
    {id:'orthopedics', name:'Orthopedics & Sports Med', blurb:'Bones, joints, and getting you back to moving.'},
    {id:'pediatrics', name:'Pediatrics', blurb:'Checkups and care built for kids.'},
    {id:'dermatology', name:'Dermatology', blurb:'Skin, hair, and nail conditions.'},
    {id:'ent', name:'ENT', blurb:'Ear, nose, and throat specialists.'},
    {id:'ophthalmology', name:'Ophthalmology', blurb:'Eye exams, vision care, and surgery.'},
    {id:'dental', name:'Dental Care', blurb:'Cleanings, fillings, and oral health.'}
  ];

  var HOSPITALS = [
    {id:'central', name:'Meridian Central Hospital', area:'Dhanmondi, Dhaka'},
    {id:'north', name:'Meridian North Hospital', area:'Uttara, Dhaka'},
    {id:'gulshan', name:'Meridian Women & Children Hospital', area:'Gulshan, Dhaka'},
    {id:'chattogram', name:'Meridian Chattogram Hospital', area:'Panchlaish, Chattogram'},
    {id:'sylhet', name:'Meridian Sylhet Hospital', area:'Zindabazar, Sylhet'}
  ];

  var DOCTORS_PER_DEPT_PER_HOSPITAL = 10;

  var EMERGENCY_DOCTORS_PER_DEPT = 3;

  var DOCTOR_NAMES = [
    'Dr. Md. Ariful Islam', 'Dr. Md. Saiful Rahman', 'Dr. Mahmud Hasan', 'Dr. Tanvir Ahmed', 'Dr. Md. Rakibul Hasan', 'Dr. Nazmul Hossain', 'Dr. Abdullah Al Mamun', 'Dr. Md. Kamrul Islam', 'Dr. Shafiqul Alam', 'Dr. Imran Hossain',
    'Dr. Farzana Akter', 'Dr. Nusrat Jahan', 'Dr. Sadia Rahman', 'Dr. Tasnim Akter', 'Dr. Sabrina Islam', 'Dr. Rumana Khatun', 'Dr. Sharmin Sultana', 'Dr. Mahmuda Akter', 'Dr. Jannatul Ferdous', 'Dr. Afsana Mim',
    'Dr. Md. Mehedi Hasan', 'Dr. Md. Raihan Kabir', 'Dr. Ashikur Rahman', 'Dr. Zahidul Islam', 'Dr. Md. Sohel Rana', 'Dr. Rafiqul Islam', 'Dr. Md. Anisur Rahman', 'Dr. Faisal Ahmed', 'Dr. Tarek Mahmud', 'Dr. Shamim Hossain',
    'Dr. Afroza Parveen', 'Dr. Nazia Sultana', 'Dr. Meherun Nesa', 'Dr. Lamia Akter', 'Dr. Fariha Islam', 'Dr. Tania Rahman', 'Dr. Naima Khatun', 'Dr. Samia Haque', 'Dr. Rafia Sultana', 'Dr. Sumaiya Akter',
    'Dr. Md. Zubayer Ahmed', 'Dr. Md. Ibrahim Khalil', 'Dr. Md. Sadman Sakib', 'Dr. Abu Sayeed', 'Dr. Md. Shakil Hossain', 'Dr. Md. Nasir Uddin', 'Dr. Md. Jahangir Alam', 'Dr. Md. Rubel Mia', 'Dr. Md. Masud Rana', 'Dr. Md. Saidur Rahman',
    'Dr. Munmun Akter', 'Dr. Roksana Parveen', 'Dr. Tamanna Islam', 'Dr. Mehzabin Chowdhury', 'Dr. Sanjida Rahman', 'Dr. Shabnam Mostary', 'Dr. Nazma Begum', 'Dr. Raisa Islam', 'Dr. Umme Habiba', 'Dr. Faria Zaman',
    'Dr. Md. Touhidul Islam', 'Dr. Md. Minhaj Uddin', 'Dr. Md. Abdul Karim', 'Dr. Md. Habibur Rahman', 'Dr. Md. Shawkat Ali', 'Dr. Md. Enamul Haque', 'Dr. Md. Said Ahmed', 'Dr. Md. Mizanur Rahman', 'Dr. Md. Farhad Hossain', 'Dr. Md. Kamal Uddin',
    'Dr. Nusaiba Rahman', 'Dr. Ishrat Jahan', 'Dr. Nabila Islam', 'Dr. Fatema Tuz Zohra', 'Dr. Nazifa Akter', 'Dr. Sumona Haque', 'Dr. Rehana Parveen', 'Dr. Lubna Yasmin', 'Dr. Shiuli Akter', 'Dr. Dilruba Khan',
    'Dr. Md. Arman Hossain', 'Dr. Md. Sakibul Islam', 'Dr. Md. Rashedul Hasan', 'Dr. Md. Abir Hossain', 'Dr. Md. Naim Islam', 'Dr. Md. Hasibur Rahman', 'Dr. Md. Faruk Ahmed', 'Dr. Md. Sumon Mia', 'Dr. Md. Tariqul Islam', 'Dr. Md. Saiful Alam',
    'Dr. Mithila Rahman', 'Dr. Sadia Sultana', 'Dr. Nazmin Akter', 'Dr. Tanzila Haque', 'Dr. Mushfika Islam', 'Dr. Sabiha Rahman', 'Dr. Rubaiya Khatun', 'Dr. Naushin Jahan', 'Dr. Samiha Akter', 'Dr. Farhana Yasmin',
    'Dr. Md. Al Amin', 'Dr. Md. Rezaul Karim', 'Dr. Md. Ziaur Rahman', 'Dr. Md. Humayun Kabir', 'Dr. Md. Abdul Halim', 'Dr. Md. Mushfiqur Rahman', 'Dr. Md. Iqbal Hossain', 'Dr. Md. Kamruzzaman', 'Dr. Md. Rashed Khan', 'Dr. Md. Mahbub Alam',
    'Dr. Taslima Akter', 'Dr. Rubina Yasmin', 'Dr. Naznin Sultana', 'Dr. Afrin Rahman', 'Dr. Humaira Islam', 'Dr. Jerin Tasnim', 'Dr. Muntaha Akter', 'Dr. Rabeya Khatun', 'Dr. Ayesha Siddika', 'Dr. Tanzina Rahman',
    'Dr. Md. Saidul Islam', 'Dr. Md. Belal Hossain', 'Dr. Md. Jasim Uddin', 'Dr. Md. Shariful Islam', 'Dr. Md. Ruhul Amin', 'Dr. Md. Sohrab Hossain', 'Dr. Md. Zakir Hossain', 'Dr. Md. Kamrul Hasan', 'Dr. Md. Nurul Islam', 'Dr. Md. Mashiur Rahman',
    'Dr. Suraiya Akter', 'Dr. Tasnuva Islam', 'Dr. Farzana Yasmin', 'Dr. Nilufa Akter', 'Dr. Rashida Begum', 'Dr. Nazia Rahman', 'Dr. Sharmin Akter', 'Dr. Nusrat Sultana', 'Dr. Rumaiya Islam', 'Dr. Tania Sultana',
    'Dr. Md. Mahfuzur Rahman', 'Dr. Md. Abdur Rahim', 'Dr. Md. Zubayer Hossain', 'Dr. Md. Rifat Hasan', 'Dr. Md. Sadikur Rahman', 'Dr. Md. Tanvir Islam', 'Dr. Md. Shamim Ahmed', 'Dr. Md. Fazlul Haque', 'Dr. Md. Nurul Huda', 'Dr. Md. Rezwanul Haque',
    'Dr. Iffat Ara', 'Dr. Munia Rahman', 'Dr. Farhana Akter', 'Dr. Sanjida Islam', 'Dr. Nazia Parveen', 'Dr. Meher Nigar', 'Dr. Tanzima Sultana', 'Dr. Rumana Parveen', 'Dr. Shayla Akter', 'Dr. Raisa Rahman',
    'Dr. Md. Nasim Ahmed', 'Dr. Md. Asif Mahmud', 'Dr. Md. Rakib Hossain', 'Dr. Md. Sadat Rahman', 'Dr. Md. Muntasir Hasan', 'Dr. Md. Adnan Kabir', 'Dr. Md. Nafis Iqbal', 'Dr. Md. Imtiaz Hossain', 'Dr. Md. Taufiq Ahmed', 'Dr. Md. Ridwan Islam',
    'Dr. Aditi Roy', 'Dr. Sushmita Das', 'Dr. Anannya Saha', 'Dr. Shreya Chakraborty', 'Dr. Puja Sarkar', 'Dr. Sumona Dutta', 'Dr. Mousumi Sen', 'Dr. Priyanka Ghosh', 'Dr. Madhumita Pal', 'Dr. Tanushree Roy',
    'Dr. Md. Ashraful Islam', 'Dr. Md. Alauddin', 'Dr. Md. Abdul Mannan', 'Dr. Md. Helal Uddin', 'Dr. Md. Shahadat Hossain', 'Dr. Md. Monir Hossain', 'Dr. Md. Zainal Abedin', 'Dr. Md. Shafiul Alam', 'Dr. Md. Elias Hossain', 'Dr. Md. Matiur Rahman',
    'Dr. Madhuri Das', 'Dr. Sanchita Roy', 'Dr. Rimjhim Sarkar', 'Dr. Arpita Sen', 'Dr. Nandita Pal', 'Dr. Debolina Ghosh', 'Dr. Sharmistha Dutta', 'Dr. Oishi Chowdhury', 'Dr. Purnima Saha', 'Dr. Sudipta Basu',
    'Dr. Md. Abdullah Al Noman', 'Dr. Md. Saif Ahmed', 'Dr. Md. Rakibul Islam', 'Dr. Md. Farhan Hossain', 'Dr. Md. Nabil Hasan', 'Dr. Md. Tasin Rahman', 'Dr. Md. Arif Hossain', 'Dr. Md. Mahir Islam', 'Dr. Md. Samiul Haque', 'Dr. Md. Fahim Ahmed',
    'Dr. Tasfia Rahman', 'Dr. Naomi Islam', 'Dr. Maisha Akter', 'Dr. Afia Sultana', 'Dr. Raisa Haque', 'Dr. Tasnia Rahman', 'Dr. Muntaha Islam', 'Dr. Fariha Akter', 'Dr. Nusaiba Sultana', 'Dr. Mahia Rahman',
    'Dr. Md. Jisan Ahmed', 'Dr. Md. Tamim Hasan', 'Dr. Md. Naimur Rahman', 'Dr. Md. Shihab Uddin', 'Dr. Md. Mahin Islam', 'Dr. Md. Sadman Rahman', 'Dr. Md. Rafsan Hossain', 'Dr. Md. Ishtiaq Ahmed', 'Dr. Md. Mashrur Hasan', 'Dr. Md. Fuad Rahman',
    'Dr. Nazmus Sakib', 'Dr. Md. Murad Hossain', 'Dr. Md. Shihab Hasan', 'Dr. Md. Tawsif Rahman', 'Dr. Md. Abirul Islam', 'Dr. Md. Rayed Ahmed', 'Dr. Md. Safwan Hossain', 'Dr. Md. Rifat Islam', 'Dr. Md. Noman Hossain', 'Dr. Md. Tanvir Kabir',
    'Dr. Sumaiya Rahman', 'Dr. Ishrat Nawrin', 'Dr. Nusrat Tabassum', 'Dr. Rafia Islam', 'Dr. Sabrina Rahman', 'Dr. Tasnim Jahan', 'Dr. Sadia Akter', 'Dr. Nazifa Rahman', 'Dr. Lamia Islam', 'Dr. Mehzabin Akter',
    'Dr. Md. Shahriar Hossain', 'Dr. Md. Rakin Islam', 'Dr. Md. Arham Rahman', 'Dr. Md. Nafiz Ahmed', 'Dr. Md. Imran Kabir', 'Dr. Md. Mushfiq Hasan', 'Dr. Md. Rayan Islam', 'Dr. Md. Sabbir Hossain', 'Dr. Md. Sifat Rahman', 'Dr. Md. Zubayer Islam',
    'Dr. Oishwarya Dutta', 'Dr. Sohini Roy', 'Dr. Trisha Chakraborty', 'Dr. Maitree Saha', 'Dr. Rupa Sarkar', 'Dr. Sharmila Pal', 'Dr. Kakoli Das', 'Dr. Mallika Ghosh', 'Dr. Anindita Basu', 'Dr. Nandini Chowdhury',
    'Dr. Md. Hafizur Rahman', 'Dr. Md. Selim Reza', 'Dr. Md. Abdus Salam', 'Dr. Md. Zahid Hasan', 'Dr. Md. Abul Kalam', 'Dr. Md. Mostafizur Rahman', 'Dr. Md. Abdul Kader', 'Dr. Md. Rafiq Ahmed', 'Dr. Md. Shaheen Alam', 'Dr. Md. Nasir Uddin Khan',
    'Dr. Nazma Sultana', 'Dr. Dilshad Parveen', 'Dr. Rowshan Ara', 'Dr. Shammi Akter', 'Dr. Farzana Haque', 'Dr. Nasrin Sultana', 'Dr. Selina Akter', 'Dr. Taslima Rahman', 'Dr. Shirin Akter', 'Dr. Rehana Islam',
    'Dr. Md. Hasanuzzaman', 'Dr. Md. Abdul Hai', 'Dr. Md. Saidul Haque', 'Dr. Md. Rubaiyat Hasan', 'Dr. Md. Mahfuz Alam', 'Dr. Md. Sadekur Rahman', 'Dr. Md. Abdul Momin', 'Dr. Md. Moin Uddin', 'Dr. Md. Abu Taher', 'Dr. Md. Nazmul Karim',
    'Dr. Tania Akter', 'Dr. Farhana Islam', 'Dr. Rumaisa Rahman', 'Dr. Sabiha Sultana', 'Dr. Meher Afroz', 'Dr. Sharmin Jahan', 'Dr. Tasnuva Rahman', 'Dr. Nusrat Nawrin', 'Dr. Afsana Rahman', 'Dr. Ishrat Islam',
    'Dr. Md. Shakib Ahmed', 'Dr. Md. Rashedul Islam', 'Dr. Md. Abdul Aziz', 'Dr. Md. Faisal Karim', 'Dr. Md. Raihan Islam', 'Dr. Md. Shawon Ahmed', 'Dr. Md. Sohag Hossain', 'Dr. Md. Zahidul Hasan', 'Dr. Md. Nur Mohammad', 'Dr. Md. Shamim Reza',
    'Dr. Aparna Roy', 'Dr. Shraboni Das', 'Dr. Keya Sarkar', 'Dr. Sayanti Chakraborty', 'Dr. Meghla Sen', 'Dr. Anamika Pal', 'Dr. Sushmita Ghosh', 'Dr. Tithi Dutta', 'Dr. Pragya Saha', 'Dr. Ritu Basu',
    'Dr. Md. Abdul Hannan', 'Dr. Md. Saiful Haque', 'Dr. Md. Zahirul Islam', 'Dr. Md. Kamal Hossain', 'Dr. Md. Azizur Rahman', 'Dr. Md. Maksud Alam', 'Dr. Md. Shamsul Haque', 'Dr. Md. Rafiqul Hasan', 'Dr. Md. Habibullah', 'Dr. Md. Faruk Hossain',
    'Dr. Nasima Akter', 'Dr. Shabnam Rahman', 'Dr. Rozina Khatun', 'Dr. Selina Parveen', 'Dr. Mahmuda Rahman', 'Dr. Layla Begum', 'Dr. Farhana Sultana', 'Dr. Nazma Akter', 'Dr. Rubina Islam', 'Dr. Sanjida Haque',
    'Dr. Md. Riaz Uddin Islam', 'Dr. Md. Mehedi Rahman', 'Dr. Md. Nasir Ahmed', 'Dr. Md. Abdul Haque', 'Dr. Md. Sadik Ahmed', 'Dr. Md. Zakaria Hossain', 'Dr. Md. Saifullah', 'Dr. Md. Nurul Amin', 'Dr. Md. Mahbubur Rahman', 'Dr. Md. Abdul Wadud',
    'Dr. Munmun Rahman', 'Dr. Naushin Akter', 'Dr. Raisa Sultana', 'Dr. Tasnim Parveen', 'Dr. Faria Islam', 'Dr. Nabila Rahman', 'Dr. Mehrin Akter', 'Dr. Shayla Rahman', 'Dr. Sumona Islam', 'Dr. Ifat Jahan',
    'Dr. Md. Ishraq Hossain', 'Dr. Md. Rafi Islam', 'Dr. Md. Safin Ahmed', 'Dr. Md. Niloy Hasan', 'Dr. Md. Touhid Ahmed', 'Dr. Md. Rafsan Islam', 'Dr. Md. Fahad Rahman', 'Dr. Md. Aryan Hossain', 'Dr. Md. Jisan Rahman', 'Dr. Md. Sakib Hasan',
    'Dr. Debashish Roy', 'Dr. Soumya Dutta', 'Dr. Amitava Chowdhury', 'Dr. Shuvro Saha', 'Dr. Aniruddha Pal', 'Dr. Sourav Ghosh', 'Dr. Sayan Sarkar', 'Dr. Arnab Basu', 'Dr. Koushik Das', 'Dr. Ritwik Sen',
    'Dr. Tanima Chowdhury', 'Dr. Anwesha Dutta', 'Dr. Madhurima Roy', 'Dr. Sanchari Ghosh', 'Dr. Oindrila Pal', 'Dr. Sudeshna Sen', 'Dr. Priyadarshini Saha', 'Dr. Indrani Basu', 'Dr. Maitreyee Sarkar', 'Dr. Shrabanti Das'
  ];

  var EXTRA_DOCTORS = [
    {name:'Dr. Mohammed Sunny Khan', hospitalId:'central', deptId:'cardiology'},
    {name:'Dr. Sadia Ayman', hospitalId:'central', deptId:'pediatrics'},
    {name:'Dr. MD Sanaf Ahmed Niaf', hospitalId:'central', deptId:'neurology'}
  ];

  var AVATAR_COLORS = ['#0F5C56','#FF6650','#F0A93E','#1C8478','#0B3D3A','#E8543F'];

  function hashStr(s){
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function seededRand(seed){
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function fmtBdt(n){
    var parts = String(Math.round(n));
    var last3 = parts.slice(-3);
    var rest = parts.slice(0, -3);
    if (rest !== '') {
      rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      return '৳' + rest + ',' + last3;
    }
    return '৳' + last3;
  }

  var ALL_DAY_SLOTS = [];
  (function buildAllDaySlots(){
    for (var minutes = 0; minutes < 24 * 60; minutes += 30) {
      var hour24 = Math.floor(minutes / 60);
      var minute = minutes % 60;
      var hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      var suffix = hour24 < 12 ? 'AM' : 'PM';
      ALL_DAY_SLOTS.push(hour12 + ':' + (minute === 0 ? '00' : '30') + ' ' + suffix);
    }
  })();

  var TIME_SLOTS = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'];

  function nextDays(n){
    var days = [];
    var now = new Date();
    for (var i = 0; i < n; i++) {
      var d = new Date(now);
      d.setDate(now.getDate() + i);
      days.push(d);
    }
    return days;
  }
  var DAYS = nextDays(7);
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function escapeHtml(text){
    return String(text || '').replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function dateKey(d){ return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function fmtDay(d, opts){
    opts = opts || {};
    if (opts.long) return DOW[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function makeInitials(name){
    var words = name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(function (w) {
      return w.toLowerCase() !== 'md.' && w.toLowerCase() !== 'md';
    });
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  var DOCTORS = [];

  function makeDoctor(counter, hospital, dept, k, name){
    var id = 'doc' + counter;
    var doc = {
      id: id,
      name: name,
      deptId: dept.id,
      deptName: dept.name,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      hospitalArea: hospital.area,
      roomLabel: 'Room ' + (100 + (hashStr(id + 'room') % 8) * 10 + (k % 4) + 1),
      years: 4 + (hashStr(id + 'y') % 24),
      rating: (4.3 + (hashStr(id + 'r') % 7) / 10).toFixed(1),
      reviews: 30 + (hashStr(id + 'v') % 340),
      emergency: k < EMERGENCY_DOCTORS_PER_DEPT,
      telehealth: hashStr(id + 't') % 3 !== 0,
      fee: 500 + (hashStr(id + 'f') % 21) * 100,
      color: AVATAR_COLORS[hashStr(id + 'c') % AVATAR_COLORS.length],
      initials: makeInitials(name),
      availability: {}
    };
    DAYS.forEach(function (d) {
      var key = dateKey(d);
      var seed = hashStr(doc.id + key);
      var slots = [];
      if (doc.emergency) {
        ALL_DAY_SLOTS.forEach(function (t) { slots.push({ time: t, booked: false }); });
        doc.availability[key] = slots;
        return;
      }
      TIME_SLOTS.forEach(function (t, ti) {
        var r = seededRand(seed + ti * 7.13);
        if (r > 0.52) {
          slots.push({ time: t, booked: seededRand(seed + ti * 3.7) < 0.22 });
        }
      });
      doc.availability[key] = slots;
    });
    DOCTORS.push(doc);
  }

  (function buildDoctors(){
    var counter = 1;
    HOSPITALS.forEach(function (hospital) {
      DEPARTMENTS.forEach(function (dept) {
        for (var k = 0; k < DOCTORS_PER_DEPT_PER_HOSPITAL; k++) {
          makeDoctor(counter, hospital, dept, k, DOCTOR_NAMES[counter - 1]);
          counter++;
        }
      });
    });
    EXTRA_DOCTORS.forEach(function (extra) {
      makeDoctor(counter, hospitalById(extra.hospitalId), deptById(extra.deptId), DOCTORS_PER_DEPT_PER_HOSPITAL, extra.name);
      counter++;
    });
  })();

  function firstAvailable(doc){
    if (doc.emergency) return { day: DAYS[0], time: 'Now', dayIndex: 0, now: true };
    for (var i = 0; i < DAYS.length; i++) {
      var key = dateKey(DAYS[i]);
      var slots = (doc.availability[key] || []).filter(function (s) { return !s.booked; });
      if (slots.length) return { day: DAYS[i], time: slots[0].time, dayIndex: i };
    }
    return null;
  }

  function doctorById(id){ return DOCTORS.filter(function (d) { return d.id === id; })[0]; }
  function deptById(id){ return DEPARTMENTS.filter(function (d) { return d.id === id; })[0]; }
  function hospitalById(id){ return HOSPITALS.filter(function (h) { return h.id === id; })[0]; }

  var TESTIMONIALS = [
    {quote:"I booked a cardiology follow-up at 11pm and had a confirmed slot for Tuesday morning before I put my phone down.", name:'Jonah R.', role:'Patient since 2022'},
    {quote:"Rescheduling used to mean sitting on hold. Now I just tap two buttons and I'm done.", name:'Priyanka S.', role:'Patient since 2019'},
    {quote:"The doctor availability is actually accurate. What I saw online matched what happened at the front desk.", name:'Marcus T.', role:'Patient since 2023'},
    {quote:"My daughter's pediatrician visits take five minutes to book now instead of a fifteen-minute phone call.", name:'Elena V.', role:'Parent, patient since 2020'},
    {quote:"Watching my live serial tick up on my phone meant I could wait at the tea stall instead of the bench.", name:'Rashed K.', role:'Patient since 2021'}
  ];

  return {
    ICONS: ICONS,
    DEPT_ICONS: DEPT_ICONS,
    DEPARTMENTS: DEPARTMENTS,
    HOSPITALS: HOSPITALS,
    DOCTORS_PER_DEPT_PER_HOSPITAL: DOCTORS_PER_DEPT_PER_HOSPITAL,
    DOCTORS: DOCTORS,
    TESTIMONIALS: TESTIMONIALS,
    TIME_SLOTS: TIME_SLOTS,
    ALL_DAY_SLOTS: ALL_DAY_SLOTS,
    EMERGENCY_DOCTORS_PER_DEPT: EMERGENCY_DOCTORS_PER_DEPT,
    DAYS: DAYS,
    DOW: DOW,
    MONTHS: MONTHS,
    escapeHtml: escapeHtml,
    hashStr: hashStr,
    seededRand: seededRand,
    fmtBdt: fmtBdt,
    dateKey: dateKey,
    fmtDay: fmtDay,
    firstAvailable: firstAvailable,
    doctorById: doctorById,
    deptById: deptById,
    hospitalById: hospitalById
  };
})();
