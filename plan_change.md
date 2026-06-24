tambahkan toggle mode dark/light

User / pengguna 3 level :
1. Admin
2. Juri 
3. Peserta Lomba

Firebase Authentication, jika belum didaftarkan admin bisa signup sebagai peserta lomba

1. Admin :
    - Login dengan google authentication firebase, email harus terdaftar di database system sebagai admin
    - Dashboard
    - Kelola Juri (Tambah, Edit, Hapus)
    - Kelola Bidang Lomba (Tambah, Edit, Hapus)
    - Kelola Proposal Lomba (Approve, Reject, Edit, Hapus, View)
    - Kelola Penilaian
    - Kelola jadwal entri dan penilaian
    - Kelola data user (Peserta Lomba dan Juri)

2. Juri : 
    - Login dengan google authentication firebase , email harus terdaftar di database system sebagai juri
    - Dashboard
    - Kelola Penilaian 
    - Proposal bisa dilihat juri setelah diapprove oleh admin
    - Kelola jadwal entri dan penilaian
    - Lihat list proposal lomba yang sudah dinilai
    - Lihat list proposal lomba yang belum dinilai
    - Lihat list proposal lomba yang diapprove
    - Lihat list proposal lomba yang di reject
    

3. Peserta Lomba : 
    - Login dengan google authentication firebase , email harus terdaftar di database system sebagai peserta lomba
    - Dashboard
    - Edit data diri
    - Buat proposal
    - Edit proposal
    - Hapus proposal
    - View proposal
    - Ajukan proposal
    - VIew proposal hanya yang dibuat dengan account sendiri
    

Proposal Lomba :

    
Data-data yang diperlukan :
    tahun	required
    email	required
    nama_email	required
    judul_inovasi	required
    bidang (Dari database bidang)	required
    jenis (Digital, Non Digital)	required
    status (Kelompok, Perorangan)	required
    kategori (Pelajar , Umum)	required
    tahap (Uji Coba, Penerapan / Implementasi, Sudah Dipasarkan)	required
    nama_inovator	required
    nama_anggota1	opsional (jika kelompok)
    nama_anggota2	opsional (jika kelompok)
    nama_anggota3	opsional (jika kelompok)
    nama_anggota4	opsional (jika kelompok)
    alamat	required
    latitude	required
    longitude	required
    phone	required
    Maps	
        
    ISI Proposal (Long Text, Rich Text Editor)	
    A. Abstrak / Ringkasan	required
    B. Latar Belakang	required
    C. Maksud dan Tujuan	required
    D. Manfaat Inovasi	required
    E. Keunggulan Inovasi	required
    F. Aspek Inovasi	required
    G. Penerapan Inovasi	required
    H. Anggaran	required
        
    Kuisioner (Jawaban singkat)	
    A. ORISINALITAS DAN KEPIONIRAN	
    1. Apakah temuan benar-benar asli milik saudara ?	required
    2. Apakah ide/inovasi hasil pengembangan sebelumnya ? Apabila Jawaban "Iya" Pengembangan ada di bagian apa ? 	required
    3. Apakah ada inovasi sejenis ? Jika ada apa perbedaan inovasi yang anda miliki ?	required
        
    B. PENERAPAN DI MASYARAKAT	
    1. Apakah sudah dilakukan Ujicoba pada lingkungan yang relevan ? Dimana dan Bagaimana hasil penerapannya ?	required
    2. Apakah inovasi yang di hasilkan sudah siap terapkan ? Siapakah yang menerapkan ?  	required
    3. Skala jangkauan penerapan pada skala apa (Nasional/Provinsi/Kab dan Kota/Kecamatan/Desa) ?	required
        
    C. MANFAAT	
    1. Apakah inovasi yang dihasilkan dapat menyelesaikan permasalahan aktual saat ini ? Jelaskan   ?	required
    2. Apakah inovasi dapat meningkatkan proses produksi/efisiensi ? Jelaskan	required
    3. Apakah memberi manfaat kelingkungan ? Dalam bentuk apa ?	required
    4. Apakah menyerap tenaga kerja pada proses produksi ? Berapa ?	required
    5. Apakah dapat meningkatkan pendapatan masyarakat ? Berapa ?	required
        
    D. KEBERLANGSUNGAN / KOMERSIALISASI	
    1. Berapa persen penyerapan penggunaan sumberdaya lokal (SDM dan Bahan baku lokal) ?	required
    2. Apakah ketersediaan bahan baku kontinyu secara kualitas dan kuantitas ?	required
        
        
    DATA DUKUNG	
    Foto Peserta	required
    Foto Produk / Hasil Inovasi (Maks 5 Foto)	required
    Identitas  Peserta (KTP / Kartu Pelajar PDF)	required
    Pernyataan Keaslian Inovasi (PDF)	required
    Video	required

