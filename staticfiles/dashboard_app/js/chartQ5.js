// chartQ5.js

// Đảm bảo hàm này được định nghĩa ở cấp độ global
// và nhận đủ 3 tham số: containerSelector, tooltipElement, và dataPath
async function drawChartQ5(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU (Rất quan trọng để đảm bảo tính hợp lệ)
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales); // Chuyển Sales sang số
            if (isNaN(d.Sales) || d.Sales < 0) {
                d.Sales = 0; // Gán là 0 nếu không phải số hoặc âm
            }
            // Đảm bảo cột segment tồn tại và không rỗng
            // Nếu bạn muốn dùng Category hoặc Sub-Category thay vì segment, hãy thay đổi d.segment ở đây
            if (typeof d.segment === 'undefined' || d.segment === null || String(d.segment).trim() === "") {
                d.segment = "Không xác định"; // Thay 'segment' bằng tên cột thực tế trong CSV, ví dụ 'segment'
            }
        });

        const totalRevenue = d3.sum(allData, d => d.Sales);

        if (isNaN(totalRevenue) || totalRevenue <= 0) {
            vizContainer.html("<p>Tổng doanh thu không hợp lệ hoặc bằng 0. Không thể vẽ biểu đồ tỷ lệ.</p>");
            console.error("Total revenue is invalid or zero:", totalRevenue);
            return;
        }

        // Đảm bảo dùng đúng tên cột 'segment' (hoặc 'Category', 'Sub-Category') ở đây
        const salesBysegmentRollup = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d.segment // ĐÃ SỬA: Sử dụng tên cột 'segment' (giả định)
        );

        let dataForChart = Array.from(salesBysegmentRollup, ([key, value]) => {
            const salesVal = value || 0;
            return {
                segment: key, // Vẫn giữ key là 'segment' cho mục đích hiển thị trong code
                Sales: salesVal,
                Percentage: (salesVal / totalRevenue) * 100
            };
        });

        // LỌC BỎ CÁC segment CÓ SALES <= 0 HOẶC PERCENTAGE LÀ NaN
        dataForChart = dataForChart.filter(d => d.Sales > 0 && d.segment !== "Không xác định" && !isNaN(d.Percentage));
        
        // Sắp xếp theo Sales để màu sắc của d3.schemeCategory10/Tableau10 ổn định cho các segment
        dataForChart.sort((a, b) => b.Sales - a.Sales);


        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Phân khúc hợp lệ (doanh thu > 0) để vẽ biểu đồ Q5.</p>");
            return;
        }
        // console.log("Final Data for Donut Chart (Q5):", JSON.stringify(dataForChart, null, 2));


        // --- BẮT ĐẦU CODE D3.JS VẼ DONUT CHART ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        // Kích thước cơ sở, giữ biểu đồ tròn và không quá lớn
        const baseDimension = Math.min(containerRect.width > 0 ? containerRect.width * 0.95 : 400, 400);
        
        const width = baseDimension;
        const height = baseDimension; 
        
        const margin = { top: 60, right: 60, bottom: 60, left: 60 }; // Margin để không bị cắt label ngoài

        // Tính toán bán kính hiệu dụng sau khi trừ margin
        const effectiveWidth = width - margin.left - margin.right;
        const effectiveHeight = height - margin.top - margin.bottom;
        let outerRadius = Math.min(effectiveWidth, effectiveHeight) / 2;

        if (outerRadius < 20) { // Nếu bán kính quá nhỏ
            vizContainer.html("<p>Không gian không đủ để vẽ biểu đồ.</p>"); return;
        }
        
        // wedgeprops=dict(width=0.9) trong Matplotlib: vành bánh chiếm 90% bán kính ngoài.
        // Lỗ ở giữa sẽ có bán kính là 10% của bán kính ngoài (R_inner = R_outer * 0.1).
        const innerRadius = outerRadius * 0.1;


        const svg = vizContainer.append("svg")
            .attr("width", width)
            .attr("height", height + margin.top/2) // Thêm chút không gian cho tiêu đề trên SVG
            .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2 + margin.top / 2})`);


        const color = d3.scaleOrdinal()
            .domain(dataForChart.map(d => d.segment))
            .range(d3.schemeTableau10); // Bảng màu đẹp

        const pie = d3.pie()
            .value(d => d.Sales) // Dữ liệu Sales đã được đảm bảo là số dương
            .sort(null)          // Giữ thứ tự dữ liệu đã sort theo Sales
            .padAngle(0.01);     // Khoảng cách nhỏ giữa các miếng

        const data_ready = pie(dataForChart);
        // console.log("Data ready for D3 Pie (Q5):", data_ready); // DEBUG

        // Arc generator CHÍNH cho các miếng bánh
        const arcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .cornerRadius(3); // Bo tròn góc

        // Vẽ các miếng bánh
        const slices = svg.selectAll('g.slice-q5')
            .data(data_ready)
            .join('g')
            .attr('class', 'slice-q5')
            .style("cursor", "pointer");

        slices.append('path')
            .attr('d', arcGenerator) // Sử dụng arcGenerator đã định nghĩa
            .attr('fill', d => color(d.data.segment))
            .attr("stroke", "white")
            .style("stroke-width", "1.5px");

        // Thêm text % bên trong mỗi miếng bánh (autopct)
        slices.filter(d => (d.endAngle - d.startAngle) > 0.15 && (outerRadius - innerRadius) > 25) // Chỉ hiển thị nếu đủ không gian
            .append('text')
            .attr("transform", d => {
                // Đặt text vào giữa vành donut
                const pos = d3.arc().innerRadius(innerRadius + 5).outerRadius(outerRadius - 5).centroid(d);
                return `translate(${pos})`;
            })
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#333")
            .style("pointer-events", "none")
            .text(d => `${Math.round(d.data.Percentage)}%`);


        // Thêm labels bên ngoài (segment Name và Sales) - CỐ GẮNG GIỐNG MATPLOTLIB
        const labelRadius = outerRadius * 1.3; // Bán kính vòng tròn chứa các label ngoài

        const outerLabelsGroup = svg.append("g").attr("class", "outer-labels-q5");

        outerLabelsGroup.selectAll("text.segment-label")
            .data(data_ready)
            .join("text")
            .attr("class", "segment-label")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", "#444")
            .attr("transform", d => {
                const angle = (d.startAngle + d.endAngle) / 2 - (Math.PI / 2); // 0 độ là trên cùng
                const xPos = labelRadius * Math.cos(angle);
                const yPos = labelRadius * Math.sin(angle);
                return `translate(${xPos},${yPos})`;
            })
            .style("text-anchor", d => { // Căn lề text
                const angle = (d.startAngle + d.endAngle) / 2;
                return (angle > Math.PI/2 && angle < Math.PI*1.5) ? "end" : "start";
            })
            .each(function(d) {
                if ((d.endAngle - d.startAngle) < 0.1) return; // Không vẽ label cho miếng quá nhỏ
                const el = d3.select(this);
                el.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "-0.2em") // Dòng 1 hơi lên trên
                    .text(d.data.segment);
                el.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "1.2em") // Dòng thứ hai xuống dưới
                    .text(`$${d.data.Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`);
            });
        
        // Tooltip
        slices
            .on("mouseover", function(event, d_pie) {
                const d_data = d_pie.data;
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Phân khúc: ${d_data.segment}</strong><br/>
                     Doanh thu: $${d_data.Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                     Tỷ lệ đóng góp: ${d_data.Percentage.toFixed(1)}%`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", d3.arc() // Tạo arc mới cho hiệu ứng
                      .innerRadius(innerRadius * 0.95) 
                      .outerRadius(outerRadius * 1.05) 
                      .padAngle(0.01) // Giữ padAngle
                      .cornerRadius(3)(d_pie) // Truyền d_pie (dữ liệu của slice)
                  );
            })
            .on("mouseout", function(event, d_pie) { // ĐÃ SỬA: SỬ DỤNG arcGenerator
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", arcGenerator(d_pie)); // TRẢ LẠI arcGenerator GỐC
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", 0) 
            .attr("y", -height / 2 - margin.top / 2 + 10) // Đẩy tiêu đề lên cao hơn
            .attr("text-anchor", "middle")
            .style("font-size", "15px").style("font-weight", "bold").style("fill", "#333")
   

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q5 (Donut Chart): ${error.message}</p>`);
        console.error("Lỗi drawChartQ5:", error);
    }
}