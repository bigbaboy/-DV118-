// chartQ12.js

// Đảm bảo hàm này được định nghĩa ở cấp độ global
// và nhận đủ 4 tham số: containerSelector, tooltipElement, orderDataPath, và returnDataPath
async function drawChartQ12(containerSelector, tooltipElement, orderDataPath, returnDataPath) { // ĐÃ SỬA: Thêm orderDataPath, returnDataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Tải dữ liệu đơn hàng chính
        const allOrders = await d3.csv(orderDataPath); // ĐÃ SỬA: Sử dụng orderDataPath
        if (!allOrders || allOrders.length === 0) {
            throw new Error(`Không tải được file dữ liệu đơn hàng từ ${orderDataPath} hoặc file rỗng.`);
        }

        // Tải dữ liệu trả hàng (có thể không có hoặc rỗng)
        let allReturns = [];
        try {
            allReturns = await d3.csv(returnDataPath); // ĐÃ SỬA: Sử dụng returnDataPath
        } catch (returnError) {
            console.warn(`Cảnh báo: Không tải được file trả hàng từ ${returnDataPath}. Tỷ lệ trả hàng sẽ là 0.`, returnError);
            allReturns = []; // Đảm bảo là mảng rỗng nếu không tải được
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allOrders.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0; // Doanh thu không thể âm
            d.Quantity = parseInt(d.Quantity); // Chuyển Quantity sang số nguyên
            if (isNaN(d.Quantity) || d.Quantity < 0) d.Quantity = 0;

            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'Product Name' viết hoa chữ P, hoặc khác)
            if (typeof d['Product Name'] === 'undefined' || d['Product Name'] === null || String(d['Product Name']).trim() === "") {
                d['Product Name'] = "Không xác định";
            }
            // Các cột khác nếu cần
        });

        // Tạo một Set các Order ID bị trả hàng để tra cứu nhanh
        const returnedOrderIds = new Set();
        if (allReturns && allReturns.length > 0) {
            allReturns.forEach(r => {
                // Giả sử cột là 'Returned' (Status) và giá trị là 'Yes'
                // (Kiểm tra lại tên cột và giá trị trong Return.csv của bạn)
                if (r.Returned === 'Yes' && r['Order ID']) {
                    returnedOrderIds.add(r['Order ID']);
                }
            });
        }

        // Gắn thông tin trả hàng vào allOrders (tương tự merge left)
        allOrders.forEach(order => {
            order.Is_Returned = returnedOrderIds.has(order['Order ID']);
        });

        // Tính toán cho từng sản phẩm
        const productReturnsRollup = d3.rollup(allOrders,
            v => ({
                Total_Sales: d3.sum(v, d => d.Sales),
                Total_Quantity: d3.sum(v, d => d.Quantity),
                Returned_Count: d3.sum(v, d => d.Is_Returned ? 1 : 0) // Đếm số dòng (sản phẩm) bị trả
                // Nếu muốn đếm theo số lượng sản phẩm bị trả (Returned_Quantity):
                // Returned_Quantity: d3.sum(v, d => d.Is_Returned ? d.Quantity : 0)
            }),
            d => d['Product Name'] // Đảm bảo tên cột này chính xác trong CSV
        );

        let dataForChart = Array.from(productReturnsRollup, ([key, value]) => ({
            'Product Name': key,
            Total_Sales: value.Total_Sales || 0,
            Total_Quantity: value.Total_Quantity || 0,
            Returned_Count: value.Returned_Count || 0,
            Return_Rate: (value.Total_Quantity > 0) ? ((value.Returned_Count || 0) / value.Total_Quantity) * 100 : 0
        }));

        // Lọc bỏ sản phẩm không hợp lệ
        dataForChart = dataForChart.filter(d => 
            d['Product Name'] !== "Không xác định" &&
            d.Total_Quantity > 0 // Chỉ xét sản phẩm có bán
        );
        dataForChart.forEach(d => { // Xử lý NaN/Infinity cho Return_Rate nếu có
             if (isNaN(d.Return_Rate) || !isFinite(d.Return_Rate)) d.Return_Rate = 0;
        });

        // Sắp xếp theo Return_Rate giảm dần để lấy top N
        dataForChart.sort((a, b) => b.Return_Rate - a.Return_Rate);
        const topN = 10;
        let topNProducts = dataForChart.slice(0, topN);

        // Sắp xếp lại top N theo Return_Rate tăng dần để vẽ (giống code Python)
        topNProducts.sort((a, b) => a.Return_Rate - b.Return_Rate);


        if (topNProducts.length === 0) {
            vizContainer.html("<p>Không có dữ liệu sản phẩm hợp lệ để vẽ biểu đồ Q12.</p>");
            return;
        }
        // console.log("Data for Dual Horizontal Bar Q12:", topNProducts);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NGANG KÉP ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 800;
        const barGroupHeight = 40; // Chiều cao cho mỗi nhóm (sản phẩm)
        const baseHeight = topNProducts.length * barGroupHeight + 120; // 120 cho margins và title

        const chartWidth = Math.max(500, baseWidth);
        const chartHeight = Math.max(350, baseHeight); 
        
        const margin = { top: 60, right: 100, bottom: 50, left: 250 }; // Tăng left/right margin

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Y Axis (Tên Sản phẩm)
        const y = d3.scaleBand()
            .range([height, 0]) // Để sản phẩm đầu tiên (Return_Rate thấp nhất sau sort) ở dưới
            .domain(topNProducts.map(d => d['Product Name']))
            .paddingInner(0.4) // Khoảng cách giữa các nhóm sản phẩm
            .paddingOuter(0.2);

        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
            .selectAll("text")
                .style("font-size", "9px")
                .call(wrapD3TextHelperQ12, margin.left - 10); // Hàm wrap text

        // X1 Axis (Doanh thu - bên dưới)
        const x1MaxSales = d3.max(topNProducts, d => d.Total_Sales);
        const x1 = d3.scaleLinear()
            .domain([0, x1MaxSales > 0 ? x1MaxSales * 1.05 : 1000])
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x1).ticks(5).tickFormat(d3.format("~s")))
            .append("text")
                .attr("x", width / 2)
                .attr("y", margin.bottom - 10)
                .attr("fill", "steelblue")
                .style("text-anchor", "middle")
                .style("font-size", "11px")
                .text("Doanh thu ($)");

        // X2 Axis (Tỷ lệ trả hàng % - ở trên cùng)
        const x2MaxReturnRate = d3.max(topNProducts, d => d.Return_Rate);
        const x2 = d3.scaleLinear()
            .domain([0, x2MaxReturnRate > 0 ? x2MaxReturnRate * 1.1 : 10]) // Tối đa 100% hoặc hơn chút
            .range([0, width]);

        svg.append("g")
            // .attr("transform", `translate(0,0)`) // Trục X2 ở trên
            .call(d3.axisTop(x2).ticks(5).tickFormat(d => `${d.toFixed(0)}%`))
            .append("text")
                .attr("x", width / 2)
                .attr("y", -margin.top / 2 - 5)
                .attr("fill", "orange")
                .style("text-anchor", "middle")
                .style("font-size", "11px")
                .text("Tỷ lệ trả hàng (%)");

        // Chiều rộng của mỗi thanh con trong nhóm (Sales và Return Rate)
        const barSubgroupHeight = y.bandwidth() / 2 * 0.9; // 0.9 để có padding nhỏ giữa 2 thanh


        // Vẽ các thanh Doanh thu (thanh trên trong mỗi nhóm)
        const salesBars = svg.selectAll(".bar-q12-sales")
            .data(topNProducts)
            .join("rect")
              .attr("class", "bar-q12-sales")
              .attr("y", d => y(d['Product Name'])) // Thanh Sales ở trên
              .attr("x", x1(0))
              .attr("width", d => x1(d.Total_Sales))
              .attr("height", barSubgroupHeight)
              .attr("fill", "steelblue")
              .style("cursor", "pointer");

        // Vẽ các thanh Tỷ lệ trả hàng (thanh dưới trong mỗi nhóm)
        const returnRateBars = svg.selectAll(".bar-q12-return")
            .data(topNProducts)
            .join("rect")
              .attr("class", "bar-q12-return")
              .attr("y", d => y(d['Product Name']) + barSubgroupHeight * 1.1) // Thanh Return Rate ở dưới + padding
              .attr("x", x2(0)) // Bắt đầu từ 0 của trục x2
              .attr("width", d => x2(d.Return_Rate))
              .attr("height", barSubgroupHeight)
              .attr("fill", "orange")
              .style("cursor", "pointer");
        
        // Tooltip
        function createTooltipHtml(d) {
            return `<strong>Sản phẩm: ${d['Product Name']}</strong><br/>
                    Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                    Tỷ lệ trả hàng: ${d.Return_Rate.toFixed(1)}%<br/>
                    (SL bán: ${d.Total_Quantity.toLocaleString()}, SL trả: ${d.Returned_Count.toLocaleString()})`;
        }

        salesBars
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(createTooltipHtml(d))
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                d3.select(this).style("filter", "brightness(0.85)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        returnRateBars
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(createTooltipHtml(d))
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                d3.select(this).style("filter", "brightness(0.85)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Tiêu đề
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - margin.top / 2 - 10) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px").style("font-weight", "bold").style("fill", "#333")
            .text("Doanh thu và tỷ lệ trả hàng theo sản phẩm (Top 10)"); // ĐÃ SỬA: Thêm tiêu đề
            
        // Legend (Đơn giản)
        const legendData = [
            { label: "Doanh thu", color: "steelblue" },
            { label: "Tỷ lệ trả hàng", color: "orange" }
        ];
        const legend = svg.selectAll(".legend-q12")
            .data(legendData)
            .join("g")
            .attr("class", "legend-q12")
            // ĐIỀU CHỈNH VỊ TRÍ LEGEND ĐỂ TRÁNH CHE TIÊU ĐỀ
            .attr("transform", (d, i) => `translate(${width - margin.right - 50}, ${i * 20 + 20})`); // Đặt xa tiêu đề hơn

        legend.append("rect")
            .attr("x", 0)
            .attr("width", 15)
            .attr("height", 15)
            .style("fill", d => d.color);

        legend.append("text")
            .attr("x", 22)
            .attr("y", 7.5)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .style("font-size", "10px")
            .text(d => d.label);


    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q12: ${error.message}</p>`);
        console.error("Lỗi drawChartQ12:", error);
    }
}

// Hàm tiện ích wrap text (nếu bạn dùng cho nhãn trục Y dài)
// Đảm bảo hàm này là global hoặc được import nếu cần cho các chart khác
function wrapD3TextHelperQ12(text, width) {
  text.each(function() {
    var text = d3.select(this),
        words = text.text().split(/\s+/).filter(Boolean).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"), // Giữ lại y nếu có
        dy = parseFloat(text.attr("dy") || 0) || 0,
        tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em"); // x=0 cho trục trái
    
    // Giới hạn số dòng wrap để tránh quá dài
    let maxLines = 3; 

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width && line.length > 1) {
        if (lineNumber < maxLines -1) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        } else {
            // Nếu đã đạt maxLines, thêm "..." và dừng
            tspan.text(line.join(" ").substring(0, Math.floor(width/5)) + "..."); // Ước lượng ký tự
            break;
        }
      }
    }
  });
}