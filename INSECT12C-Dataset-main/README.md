# INSECT12C-Dataset

Soybean pest image dataset.

![fig2](https://github.com/EvertonTetila/INSECT12C-Dataset/assets/37840161/8e440c3f-d882-4fa0-af7a-9e08eeaf84e2)

# Image acquisition

We sowed an experimental area of 2 hectares with soybeans and without the application of pesticides. The agricultural area is located in the UFGD experimental farm located in the municipality of Dourados-MS, Brazil, 22°13’57.52”S, 54°59’17.93”W.

We used a Samsung Galaxy S7 smartphone equipped with a 12.2 megapixel SM-G930F rear camera to collect images of insects present in the experimental area. A total of 1,800 images (3024x4032 pixels) were collected in different days and under various weather conditions, at the times 8am-10am and 5pm-6:30pm. Soybean plants at the phenological stages R1 to R6 were imaged during the 2017-2018 season.

Images were captured on site, using a camera 50 cm away from the target of interest and at a 90° angle with the ground. The targets, in this case, correspond to defoliating insects that can cause economic damage in soybean fields. Then, we annotated each image using Labellmg https://github.com/tzutalin/labelImg with the support of an entomologist, thus building a reference collection for training and testing the system, called INSECT12C-Dataset. INSECT12C-Dataset is composed of 2,758 annotated insects from 12 species and can serve as a baseline for real-time detection of insect pests by species in soybeans.

# Dataset download 

Link: http://evertontetila.ws.ufgd.edu.br/Datasets/INSECT12C-Dataset.zip

# Acknowledgements

This dataset was created by the authors and should be cited as follows:

TETILA, EVERTON CASTELÃO; GODOY DA SILVEIRA, FÁBIO AMARAL ; DA COSTA, ANDERSON BESSA ; AMORIM, WILLIAN PARAGUASSU ; ASTOLFI, GILBERTO ; PISTORI, HEMERSON ; BARBEDO, JAYME GARCIA ARNAL . YOLO performance analysis for real-time detection of soybean pests. Smart Agricultural Technology, v. 7, p. 100405, 2024. https://doi.org/10.1016/j.atech.2024.100405
